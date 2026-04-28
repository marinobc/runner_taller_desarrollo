const fs = require('fs');
const path = require('path');

class ServiceDiscovery {
    static COLORS = [
        "#7c6af7", "#4fc3f7", "#f97316", "#22c55e",
        "#f43f5e", "#eab308", "#a78bfa", "#06b6d4",
        "#84cc16", "#ec4899",
    ];

    static KNOWN_ORDER = {
        "service-registry": 1, "api-gateway": 2, "access-control-service": 3,
        "identity-service": 4, "notification-service": 5, "property-service": 6,
        "user-service": 7, "visit-calendar-service": 8,
    };

    static toLabel(id) {
        return id.replace(/-service$/, "").replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())
            + (id.endsWith("-service") || id === "api-gateway" || id === "service-registry" ? "" : "");
    }

    static extractNodePort(dir) {
        let port = 5173; // Default for Vite
        
        try {
            const pkgPath = path.join(dir, "package.json");
            if (fs.existsSync(pkgPath)) {
                const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
                const devScript = pkg.scripts?.dev || "";
                const scriptMatch = devScript.match(/--port\s+(\d+)/);
                if (scriptMatch) return parseInt(scriptMatch[1]);
            }

            const viteConfigs = ["vite.config.ts", "vite.config.js"];
            for (const cfg of viteConfigs) {
                const cfgPath = path.join(dir, cfg);
                if (fs.existsSync(cfgPath)) {
                    const content = fs.readFileSync(cfgPath, "utf-8");
                    const portMatch = content.match(/port:\s*(\d+)/);
                    if (portMatch) return parseInt(portMatch[1]);
                }
            }
        } catch (e) {
            console.error("Node port extraction error:", e.message);
        }
        
        return port;
    }

    static scan(backendRoot, frontendRoot) {
        const list = [];
        let colorIdx = 0;

        let envPorts = {};
        if (backendRoot && fs.existsSync(path.join(backendRoot, '.env'))) {
            try {
                const envContent = fs.readFileSync(path.join(backendRoot, '.env'), 'utf-8');
                const envLines = envContent.split('\n');
                for (let line of envLines) {
                    line = line.trim();
                    const match = line.match(/^([^=]+)=(.+)$/);
                    if (match) {
                        envPorts[match[1].trim()] = match[2].trim();
                    }
                }
            } catch (e) { console.error("Error reading .env:", e.message); }
        }

        if (backendRoot && fs.existsSync(backendRoot)) {
            try {
                const entries = fs.readdirSync(backendRoot, { withFileTypes: true });
                for (const entry of entries) {
                    if (!entry.isDirectory()) continue;
                    const dir = path.join(backendRoot, entry.name);
                    const pomPath = path.join(dir, "pom.xml");
                    const pkgPath = path.join(dir, "package.json");
                    if (!fs.existsSync(pomPath) && !fs.existsSync(pkgPath)) continue;

                    const id = entry.name;
                    let port = null;
                    let type = fs.existsSync(pomPath) ? "maven" : "node";

                    if (type === "maven") {
                        let envKeyName = id.toUpperCase().replace(/-/g, '_') + '_PORT';
                        if (id === 'service-registry') envKeyName = 'EUREKA_PORT';
                        
                        if (envPorts[envKeyName]) {
                            port = parseInt(envPorts[envKeyName]);
                        }

                        if (!port) {
                            const configPaths = [
                                path.join(dir, "src/main/resources/application.properties"),
                            path.join(dir, "src/main/resources/application.yml"),
                            path.join(dir, "src/main/resources/application.yaml"),
                            path.join(dir, "application.properties"),
                            path.join(dir, "application.yml"),
                            path.join(dir, "application.yaml")
                        ];

                        for (const cp of configPaths) {
                            if (fs.existsSync(cp)) {
                                const content = fs.readFileSync(cp, "utf-8");
                                if (cp.endsWith(".properties")) {
                                    const match = content.match(/^server\.port\s*=\s*(\d+)/m);
                                    if (match) { port = parseInt(match[1]); break; }
                                } else {
                                    const lines = content.split('\n');
                                    let inServer = false;
                                    for (const line of lines) {
                                        const trimmed = line.trim();
                                        if (trimmed === 'server:') { inServer = true; continue; }
                                        if (inServer) {
                                            if (line.match(/^\s*$/)) continue;
                                            if (line.startsWith('  ') || line.startsWith('\t')) {
                                                const portMatch = line.match(/^\s*port:\s*(\d+)/);
                                                if (portMatch) { port = parseInt(portMatch[1]); break; }
                                            } else { inServer = false; }
                                        }
                                    }
                                    if (port) break;
                                    const ymlMatch = content.match(/server:\s*[\s\S]*?port:\s*(\d+)/);
                                    if (ymlMatch) { port = parseInt(ymlMatch[1]); break; }
                                }
                            }
                        }
                        }
                    } else {
                        port = this.extractNodePort(dir);
                    }

                    list.push({
                        id, label: this.toLabel(id), type,
                        color: this.COLORS[colorIdx++ % this.COLORS.length],
                        order: this.KNOWN_ORDER[id] ?? 99,
                        port
                    });
                }
            } catch (e) { console.error("Discovery error:", e.message); }
        }

        if (frontendRoot && fs.existsSync(frontendRoot)) {
            const pkgPath = path.join(frontendRoot, "package.json");
            if (fs.existsSync(pkgPath)) {
                list.push({
                    id: "frontend", label: "Frontend", type: "node",
                    npm_script: "dev", color: "#22c55e", order: 99,
                    port: this.extractNodePort(frontendRoot)
                });
            }
        }

        return list.sort((a, b) => a.order - b.order);
    }
}

module.exports = ServiceDiscovery;
