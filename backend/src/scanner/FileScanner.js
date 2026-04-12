const fs = require('fs');
const path = require('path');

class FileScanner {
    static async scanDirectory(rootPath, basePath = null, concatConfig = null, tokenService = null, actualRootPath = null, gitignoreInstance = null) {
        const actualBase = basePath || rootPath;
        const currentRoot = actualRootPath || actualBase;
        if (!rootPath || !fs.existsSync(rootPath)) return [];
        
        // Defaults if no config provided
        const cConfig = concatConfig || {
            ignoreBinaries: true,
            ignoreHiddenDirs: true,
            ignoreLockfiles: true,
            useGitignore: true,
            skipDirsList: ".git\nnode_modules\ntarget\ndist\nbuild\ntest\n__pycache__\nvenv\n.venv\nenv\n.env",
            skipFilesList: ".gitignore\n.DS_Store",
            skipExtsList: ".png\n.jpg\n.exe\n.dll\n.zip\n.pyc\n.pyo\n.pyd",
            includeContent: true,
            headerStyle: "compact"
        };

        // Load root .gitignore if enabled and not already loaded
        let currentGitignore = gitignoreInstance;
        if (cConfig.useGitignore && !currentGitignore && rootPath === actualBase) {
            currentGitignore = this.loadGitignore(actualBase);
        }

        const skipDirs = (cConfig.skipDirsList || "").split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
        const skipFiles = (cConfig.skipFilesList || "").split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
        const skipExts = (cConfig.skipExtsList || "").split(/[\n,]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
        if (cConfig.ignoreLockfiles) skipFiles.push('package-lock.json', 'yarn.lock', 'pnpm-lock.yaml');
        const customPatterns = (cConfig.customPatternsList || "").split(/[\n,]+/).map(s => s.trim()).filter(Boolean);

        const files = [];
        
        try {
            const entries = await fs.promises.readdir(rootPath, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(rootPath, entry.name);
                const relativePath = path.relative(actualBase, fullPath);
                
                // Check gitignore
                if (currentGitignore && this.isIgnored(currentGitignore, relativePath, entry.isDirectory())) {
                    continue;
                }

                if (entry.isDirectory()) {
                    const isHiddenDir = cConfig.ignoreHiddenDirs && entry.name.startsWith('.');
                    const matchesCustom = customPatterns.some(p => FileScanner.matchPattern(p, relativePath, entry.name, true));
                    if (!skipDirs.includes(entry.name) && !isHiddenDir && !matchesCustom) {
                        const subFiles = await this.scanDirectory(fullPath, actualBase, cConfig, tokenService, currentRoot, currentGitignore);
                        files.push(...subFiles);
                    }
                } else if (entry.isFile()) {
                    const ext = path.extname(entry.name).toLowerCase();
                    const isHiddenFile = cConfig.ignoreHiddenDirs && entry.name.startsWith('.');
                    const matchesCustom = customPatterns.some(p => FileScanner.matchPattern(p, relativePath, entry.name, false));
                    
                    if (!skipExts.includes(ext) && !skipFiles.includes(entry.name) && !isHiddenFile && !matchesCustom) {
                        try {
                            const stats = await fs.promises.stat(fullPath);
                            const tokens = tokenService ? tokenService.getTokenCount(currentRoot, relativePath, !!cConfig.minify) : 0;
                            files.push({
                                name: entry.name,
                                path: relativePath,
                                size: stats.size,
                                tokens,
                                root: path.basename(actualBase)
                            });
                        } catch (err) {
                            console.error(`Error reading file ${fullPath}:`, err.message);
                        }
                    }
                }
            }
        } catch (err) {
            console.error(`Error scanning directory ${rootPath}:`, err.message);
        }
        
        return files;
    }

    static loadGitignore(rootPath) {
        const gitignorePath = path.join(rootPath, '.gitignore');
        if (!fs.existsSync(gitignorePath)) return null;
        
        try {
            const content = fs.readFileSync(gitignorePath, 'utf-8');
            return content.split(/\r?\n/)
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('#'))
                .map(pattern => {
                    // Very basic gitignore to regex/glob helper
                    let p = pattern;
                    const isDirOnly = p.endsWith('/');
                    if (isDirOnly) p = p.slice(0, -1);
                    
                    return {
                        original: pattern,
                        regex: this.globToRegex(p),
                        isDirOnly
                    };
                });
        } catch (e) {
            return null;
        }
    }

    static isIgnored(patterns, relPath, isDir) {
        const normalizedPath = relPath.replace(/\\/g, '/').replace(/^\//, '');
        for (const p of patterns) {
            if (p.isDirOnly && !isDir) continue;
            
            // Check if pattern matches the start of path (for dirs) or the whole path
            if (p.regex.test(normalizedPath) || normalizedPath.split('/').some(part => p.regex.test(part))) {
                return true;
            }
        }
        return false;
    }

    static globToRegex(pattern) {
        let p = pattern;
        // Escape characters
        p = p.replace(/[.+^${}()|[\]\\]/g, '\\$&');
        // Handle stars
        p = p.replace(/\*\*/g, '(.+)'); // Recursive wildcard
        p = p.replace(/(?<!\.)\*/g, '[^/]+'); // Single level wildcard (not preceded by .)
        
        // If it starts with /, it's relative to root. Otherwise it can match anywhere.
        if (pattern.startsWith('/')) {
            return new RegExp('^' + p.substring(1));
        } else {
            return new RegExp('(^|/)' + p + '($|/)');
        }
    }

    static matchPattern(pattern, relPath, name, isDir) {
        const cleanPattern = pattern.trim();
        if (!cleanPattern) return false;
        const normalizedPath = relPath.replace(/\\/g, '/').replace(/^\//, '');
        if (!cleanPattern.includes('/')) {
            const r = this.globToRegex(cleanPattern);
            return r.test(name) || r.test(normalizedPath);
        }
        const dirAware = cleanPattern.endsWith('/');
        const p = dirAware ? cleanPattern.slice(0, -1) : cleanPattern;
        const r = this.globToRegex(p);
        if (dirAware && !isDir) return false;
        return r.test(normalizedPath);
    }
}

module.exports = FileScanner;

