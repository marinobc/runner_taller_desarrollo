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
            mongoUri: "mongodb://admin:admin@localhost:27017/?authSource=admin",
            seedTestingPassword: "password",
            bcryptRounds: 12,
            // JVM tuning applied at runner level when launching maven services.
            // fork=false makes Maven reuse its own JVM for the app (halves JVM count).
            // TieredStopAtLevel=1 disables the C2 JIT compiler that causes CPU spikes on startup.
            jvm: {
                disableFork: true,
                heapMin: "64m",
                heapMax: "512m",
                extraFlags: "-XX:TieredStopAtLevel=1",
                startAllDelayMs: 5000
            },
            docker: {
                services: {}  // { mongodb: { ports: [{host: 27017}], env: [...] }, ... }
            },
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
                    jvm: {
                        ...defaults.jvm,
                        ...(parsed.jvm || {})
                    },
                    concat: {
                        ...defaults.concat,
                        ...(parsed.concat || {})
                    },
                    docker: {
                        ...defaults.docker,
                        ...(parsed.docker || {}),
                        services: {
                            ...defaults.docker.services,
                            ...(parsed.docker?.services || {})
                        }
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
