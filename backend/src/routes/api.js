const express = require('express');
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const { getEncoding } = require('js-tiktoken');
const ServiceDiscovery = require('../services/ServiceDiscovery');
const FileScanner = require('../scanner/FileScanner');
const logger = require('../services/Logger');
const Minifier = require('../services/Minifier');
const seedRoutes = require('./seed');

let fsWatcher = null;

module.exports = function(configManager, processManager, tokenService) {
    const router = express.Router();

    // Initialize logger from config
    logger.setEnabled(configManager.get().debugMode);

    function setupWatcher(cfg) {
        if (fsWatcher) fsWatcher.close();
        const watchPaths = [];
        if (cfg.backendRoot && fs.existsSync(cfg.backendRoot)) watchPaths.push(cfg.backendRoot);
        if (cfg.frontendRoot && fs.existsSync(cfg.frontendRoot)) watchPaths.push(cfg.frontendRoot);
        if (watchPaths.length === 0) return;

        const cConfig = cfg.concat || {
            ignoreHiddenDirs: true,
            ignoreLockfiles: true,
            skipDirsList: ".git\nnode_modules\ntarget\ndist\nbuild\ntest\n__pycache__\nvenv\n.venv\nenv\n.env",
            skipFilesList: ".gitignore\n.DS_Store",
            skipExtsList: ".png\n.jpg\n.exe\n.dll\n.zip\n.pyc\n.pyo\n.pyd"
        };

        const skipDirs = (cConfig.skipDirsList || "").split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
        const skipFiles = (cConfig.skipFilesList || "").split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
        const skipExts = (cConfig.skipExtsList || "").split(/[\n,]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
        if (cConfig.ignoreLockfiles) skipFiles.push('package-lock.json', 'yarn.lock', 'pnpm-lock.yaml');
        const customPatterns = (cConfig.customPatternsList || "").split(/[\n,]+/).map(s => s.trim()).filter(Boolean);

        fsWatcher = chokidar.watch(watchPaths, {
            ignored: (p, stats) => {
                const name = path.basename(p);
                const ext = path.extname(p).toLowerCase();
                const isDir = stats?.isDirectory();

                // Hidden files/dirs
                if (cConfig.ignoreHiddenDirs && name.startsWith('.')) return true;
                
                // Dir skips
                if (skipDirs.includes(name)) return true;
                
                // File skips
                if (skipFiles.includes(name)) return true;
                
                // Ext skips
                if (skipExts.includes(ext)) return true;

                // Custom patterns (simplified matching for watcher)
                if (customPatterns.length > 0) {
                    const relativeP = watchPaths.reduce((acc, root) => {
                        if (p.startsWith(root)) return path.relative(root, p);
                        return acc;
                    }, p);
                    if (customPatterns.some(pat => FileScanner.matchPattern(pat, relativeP, name, isDir))) {
                        return true;
                    }
                }

                return false;
            },
            ignoreInitial: true,
            persistent: true
        });

        let debounceFs;
        fsWatcher.on('all', (event, p) => {
            // Update token cache on changes
            if (event === 'add' || event === 'change') {
                const root = cfg.backendRoot && p.startsWith(cfg.backendRoot) ? cfg.backendRoot : (cfg.frontendRoot && p.startsWith(cfg.frontendRoot) ? cfg.frontendRoot : null);
                if (root) {
                    const relativeP = path.relative(root, p);
                    tokenService.updateTokenCount(root, relativeP, !!cConfig.minify);
                }
            } else if (event === 'unlink') {
                const root = cfg.backendRoot && p.startsWith(cfg.backendRoot) ? cfg.backendRoot : (cfg.frontendRoot && p.startsWith(cfg.frontendRoot) ? cfg.frontendRoot : null);
                if (root) {
                    const relativeP = path.relative(root, p);
                    tokenService.deleteTokenCount(root, relativeP);
                }
            }

            clearTimeout(debounceFs);
            debounceFs = setTimeout(() => {
                processManager.broadcastGlobal("FILESYSTEM_CHANGED", "SYSTEM");
            }, 1000);
        });
    }

    // Initialize watcher directly on boot payload
    setupWatcher(configManager.get());

    // Logging Middleware
    router.use((req, res, next) => {
        logger.debug(`[${req.method}] ${req.path}`);
        next();
    });

    router.get("/state", async (req, res) => {
        const cfg = configManager.get();
        const svcList = ServiceDiscovery.scan(cfg.backendRoot, cfg.frontendRoot);
        
        const result = await Promise.all(svcList.map(async svcDef => {
            processManager.ensureService(svcDef);
            const state = processManager.services.get(svcDef.id) || {};
            const conflictingPid = await processManager.getPidOnPort(svcDef.port);
            return { 
                ...svcDef, 
                running: state.running || false, 
                pid: state.pid || null,
                conflictingPid: conflictingPid
            };
        }));

        res.json({ config: cfg, services: result });
    });

    router.post("/config", async (req, res) => {
        const { backendRoot, frontendRoot } = req.body;
        configManager.save({ backendRoot, frontendRoot });

        const cfg = configManager.get();
        setupWatcher(cfg);

        const svcList = ServiceDiscovery.scan(cfg.backendRoot, cfg.frontendRoot);
        processManager.broadcastGlobal(`📂 Paths updated — found ${svcList.length} service(s)`, "INFO");

        const result = await Promise.all(svcList.map(async svcDef => {
            processManager.ensureService(svcDef);
            const state = processManager.services.get(svcDef.id);
            const conflictingPid = await processManager.getPidOnPort(svcDef.port);
            return { 
                ...svcDef, 
                running: state?.running || false, 
                pid: state?.pid || null,
                conflictingPid: conflictingPid
            };
        }));

        res.json({ ok: true, services: result, config: cfg });
    });

    router.get("/concat-config", (req, res) => {
        const cfg = configManager.get();
        res.json({ concat: cfg.concat });
    });

    router.post("/concat-config", (req, res) => {
        const updates = req.body;
        configManager.save({ concat: { ...configManager.get().concat, ...updates } });
        setupWatcher(configManager.get());
        res.json({ ok: true, concat: configManager.get().concat });
    });

    router.post("/scan-files", async (req, res) => {
        const { paths } = req.body;
        if (!paths || !Array.isArray(paths)) return res.status(400).json({ error: "Invalid paths" });

        const cfg = configManager.get();
        const allFiles = [];

        if (paths.includes('backend') && cfg.backendRoot && fs.existsSync(cfg.backendRoot)) {
            try {
                const files = await FileScanner.scanDirectory(cfg.backendRoot, null, cfg.concat, tokenService);
                files.forEach(f => allFiles.push({ ...f, root: 'backend' }));
            } catch (err) {}
        }

        if (paths.includes('frontend') && cfg.frontendRoot && fs.existsSync(cfg.frontendRoot)) {
            try {
                const files = await FileScanner.scanDirectory(cfg.frontendRoot, null, cfg.concat, tokenService);
                files.forEach(f => allFiles.push({ ...f, root: 'frontend' }));
            } catch (err) {}
        }

        res.json({ files: allFiles });
    });

    router.post("/get-tree", async (req, res) => {
        const { rootPath, relativePath = '' } = req.body;
        if (!rootPath) return res.status(400).json({ error: "Root path required" });
        
        const fullPath = path.join(rootPath, relativePath);
        if (!fs.existsSync(fullPath)) return res.status(404).json({ error: "Path not found" });
        
        try {
            const entries = await fs.promises.readdir(fullPath, { withFileTypes: true });
            const tree = [];
            const cConfig = configManager.get().concat;
            const skipDirs = (cConfig.skipDirsList || "").split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
            const skipFiles = (cConfig.skipFilesList || "").split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
            const skipExts = (cConfig.skipExtsList || "").split(/[\n,]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
            if (cConfig.ignoreLockfiles) skipFiles.push('package-lock.json', 'yarn.lock', 'pnpm-lock.yaml');
            const customPatterns = (cConfig.customPatternsList || "").split(/[\n,]+/).map(s => s.trim()).filter(Boolean);

            const gitignoreInstance = cConfig.useGitignore ? FileScanner.loadGitignore(rootPath) : null;
            
            for (const entry of entries) {
                const entryRelativePath = path.join(relativePath, entry.name);
                
                // Check gitignore
                if (gitignoreInstance && FileScanner.isIgnored(gitignoreInstance, entryRelativePath, entry.isDirectory())) {
                    continue;
                }

                if (entry.isDirectory()) {
                    const isHiddenDir = cConfig.ignoreHiddenDirs && entry.name.startsWith('.');
                    const matchesCustom = customPatterns.some(p => FileScanner.matchPattern(p, entryRelativePath, entry.name, true));
                    if (!skipDirs.includes(entry.name) && !isHiddenDir && !matchesCustom) {
                        tree.push({ name: entry.name, path: entryRelativePath, type: 'directory', children: [] });
                    }
                } else if (entry.isFile()) {
                    const ext = path.extname(entry.name).toLowerCase();
                    const isHiddenFile = cConfig.ignoreHiddenDirs && entry.name.startsWith('.');
                    const matchesCustom = customPatterns.some(p => FileScanner.matchPattern(p, entryRelativePath, entry.name, false));
                    
                    if (!skipExts.includes(ext) && !skipFiles.includes(entry.name) && !isHiddenFile && !matchesCustom) {
                        const stats = await fs.promises.stat(path.join(fullPath, entry.name));
                        const tokens = tokenService.getTokenCount(rootPath, entryRelativePath, !!cConfig.minify);
                        tree.push({ name: entry.name, path: entryRelativePath, type: 'file', size: stats.size, tokens });
                    }
                }
            }
            res.json({ tree });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post("/read-file", (req, res) => {
        const { root, relativePath } = req.body;
        const cfg = configManager.get();
        const basePath = root === 'backend' ? cfg.backendRoot : cfg.frontendRoot;
        if (!basePath) return res.status(400).json({ error: "Root not configured" });

        const safePath = path.resolve(basePath, relativePath);
        if (!safePath.startsWith(basePath)) return res.status(403).json({ error: "Access denied" });

        try {
            const content = fs.readFileSync(safePath, 'utf-8');
            res.json({ content });
        } catch (e) {
            res.status(500).json({ error: "Could not read file" });
        }
    });

    router.post("/generate-concat", (req, res) => {
        const { files } = req.body;
        if (!files || !Array.isArray(files)) return res.status(400).json({ error: "Invalid files" });

        const cfg = configManager.get();
        const concatCfg = cfg.concat || {};
        const includeContent = concatCfg.includeContent !== false;
        const headerStyle = concatCfg.headerStyle || "compact";

        let output = "";

        files.forEach(f => {
            const basePath = f.root === 'backend' ? cfg.backendRoot : cfg.frontendRoot;
            if (!basePath) return;

            const fullPath = path.resolve(basePath, f.path);
            if (!fullPath.startsWith(basePath)) return;

            try {
                if (headerStyle === 'divider') {
                    output += `==========\nFILE: ${f.root}/${f.path}\n==========\n`;
                } else {
                    output += `FILE: ${f.root}/${f.path}\n`;
                }

                if (includeContent) {
                    let content = fs.readFileSync(fullPath, 'utf-8');
                    if (concatCfg.minify) {
                        content = Minifier.minify(content, f.path);
                    }
                    output += `${content}${concatCfg.minify ? '\n' : '\n\n'}`;
                }
            } catch(e) {
                console.error(`Error reading ${f.path}`);
            }
        });

        let tokens = tokenService.calculateTokens(output);

        res.json({ result: output, tokens });
    });

    router.post("/services/:id/start", (req, res) => {
        processManager.start(req.params.id, configManager.get(), req.body);
        res.json({ ok: true });
    });

    router.post("/services/:id/stop", (req, res) => {
        processManager.stop(req.params.id);
        res.json({ ok: true });
    });

    router.post("/services/start-all", (req, res) => {
        const cfg = configManager.get();
        const list = ServiceDiscovery.scan(cfg.backendRoot, cfg.frontendRoot);
        let delay = 0;
        list.forEach(svc => {
            processManager.ensureService(svc);
            const state = processManager.services.get(svc.id);
            if (!state.running) {
                setTimeout(() => processManager.start(svc.id, cfg, req.body), delay);
                delay += 800;
            }
        });
        res.json({ ok: true });
    });

    router.post("/services/stop-all", (req, res) => {
        for (const [id, svc] of processManager.services) {
            if (svc.running) processManager.stop(id);
        }
        res.json({ ok: true });
    });
    
    router.get("/ports/check/:port", async (req, res) => {
        const pid = await processManager.getPidOnPort(req.params.port);
        res.json({ pid });
    });

    router.post("/ports/kill/:pid", async (req, res) => {
        await processManager.killProcess(req.params.pid);
        res.json({ ok: true });
    });

    router.post("/debug/toggle", (req, res) => {
        const current = configManager.get().debugMode || false;
        const next = !current;
        configManager.save({ debugMode: next });
        logger.setEnabled(next);
        logger.info(`Debug mode ${next ? 'enabled' : 'disabled'}`);
        res.json({ debugMode: next });
    });

    router.post("/ports/nuke-all", async (req, res) => {
        const { services } = req.body;
        if (!services || !Array.isArray(services)) return res.status(400).json({ error: "Services list required" });
        const count = await processManager.nukeAll(services);
        res.json({ ok: true, count });
    });

    router.get("/services/:id/logs", (req, res) => {
        const svc = processManager.services.get(req.params.id);
        res.json({ logs: svc ? svc.logs : [] });
    });

    router.post("/services/:id/clear-logs", (req, res) => {
        processManager.broadcastServiceClear(req.params.id);
        res.json({ ok: true });
    });

    router.get("/stream/global", (req, res) => {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders();
        processManager.globalClients.add(res);
        req.on("close", () => processManager.globalClients.delete(res));
    });

    router.get("/stream/:id", (req, res) => {
        const svc = processManager.services.get(req.params.id);
        if (!svc) return res.status(404).end();

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders();

        for (const entry of svc.logs) res.write(`data: ${JSON.stringify(entry)}\n\n`);

        svc.sseClients.add(res);
        req.on("close", () => svc.sseClients.delete(res));
    });

    // Seed routes
    router.use('/seeds', seedRoutes(configManager));

    return router;
};
