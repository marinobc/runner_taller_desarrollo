const fs = require('fs');

class ConfigManager {
    constructor(configPath) {
        this.configPath = configPath;
        this.config = this.load();
    }

    load() {
        const defaults = {
            backendRoot: "", frontendRoot: "", port: 3333,
            debugMode: false,
            mongoUri: "mongodb://admin:admin@localhost:27017/inmobiliaria_db?authSource=admin",
            mongoDbName: "inmobiliaria_db",
            seedTestingPassword: "password",
            bcryptRounds: 12,
            concat: {
                ignoreBinaries: true,
                ignoreHiddenDirs: true,
                ignoreLockfiles: true,
                minify: false,
                useGitignore: true,
                skipDirsList: ".git\nnode_modules\ntarget\ndist\nbuild\ntest\n__pycache__\nvenv\n.venv\nenv\n.env",
                skipFilesList: ".gitignore\n.DS_Store",
                skipExtsList: ".png\n.jpg\n.exe\n.dll\n.zip\n.jpeg\n.gif\n.ico\n.pdf\n.pyc\n.pyo\n.pyd",
                customPatternsList: "*.min.js\n*.map\n*.md\nmvn*\n*.svg",
                includeContent: true,
                headerStyle: "compact"
            }
        };
        try {
            if (fs.existsSync(this.configPath)) {
                const data = fs.readFileSync(this.configPath, 'utf-8');
                const parsed = JSON.parse(data);
                return {
                    ...defaults,
                    ...parsed,
                    concat: {
                        ...defaults.concat,
                        ...(parsed.concat || {})
                    }
                };
            }
        } catch (e) {
            console.warn(`⚠️ Config load failed, using defaults: ${e.message}`);
        }
        return defaults;
    }

    save(updates) {
        this.config = { ...this.config, ...updates };
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
        } catch (e) {
            console.error(`⚠️ Config save failed: ${e.message}`);
        }
    }

    get() {
        return this.config;
    }
}

module.exports = ConfigManager;
