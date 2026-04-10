const fs = require('fs');
const path = require('path');

class FileScanner {
    static async scanDirectory(rootPath, basePath = null, concatConfig = null) {
        const actualBase = basePath || rootPath;
        if (!rootPath || !fs.existsSync(rootPath)) return [];
        
        // Defaults if no config provided
        const cConfig = concatConfig || {
            ignoreBinaries: true,
            ignoreHiddenDirs: true,
            ignoreLockfiles: true,
            skipDirsList: ".git\nnode_modules\ntarget\ndist\nbuild\ntest\n__pycache__\nvenv\n.venv\nenv\n.env",
            skipFilesList: ".gitignore\n.DS_Store",
            skipExtsList: ".png\n.jpg\n.exe\n.dll\n.zip\n.pyc\n.pyo\n.pyd",
            includeContent: true,
            headerStyle: "compact"
        };

        const skipDirs = cConfig.skipDirsList.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
        const skipFiles = cConfig.skipFilesList.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
        const skipExts = cConfig.skipExtsList.split(/[\n,]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
        if (cConfig.ignoreLockfiles) skipFiles.push('package-lock.json', 'yarn.lock', 'pnpm-lock.yaml');
        const customPatterns = (cConfig.customPatternsList || "").split(/[\n,]+/).map(s => s.trim()).filter(Boolean);

        const files = [];
        
        try {
            const entries = await fs.promises.readdir(rootPath, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(rootPath, entry.name);
                const relativePath = path.relative(actualBase, fullPath);
                
                if (entry.isDirectory()) {
                    const isHiddenDir = cConfig.ignoreHiddenDirs && entry.name.startsWith('.');
                    const matchesCustom = customPatterns.some(p => FileScanner.matchPattern(p, relativePath, entry.name, true));
                    if (!skipDirs.includes(entry.name) && !isHiddenDir && !matchesCustom) {
                        const subFiles = await this.scanDirectory(fullPath, actualBase, cConfig);
                        files.push(...subFiles);
                    }
                } else if (entry.isFile()) {
                    const ext = path.extname(entry.name).toLowerCase();
                    const isHiddenFile = cConfig.ignoreHiddenDirs && entry.name.startsWith('.');
                    const matchesCustom = customPatterns.some(p => FileScanner.matchPattern(p, relativePath, entry.name, false));
                    
                    if (!skipExts.includes(ext) && !skipFiles.includes(entry.name) && !isHiddenFile && !matchesCustom) {
                        try {
                            const stats = await fs.promises.stat(fullPath);
                            files.push({
                                name: entry.name,
                                path: relativePath,
                                size: stats.size,
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

    static globToRegex(pattern) {
        const escaped = pattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replace(/\*\*/g, '::DOUBLESTAR::')
            .replace(/\*/g, '[^/]*')
            .replace(/\?/g, '.');
        const finalPattern = escaped.replace(/::DOUBLESTAR::/g, '.*');
        return new RegExp(`^${finalPattern}$`, 'i');
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
