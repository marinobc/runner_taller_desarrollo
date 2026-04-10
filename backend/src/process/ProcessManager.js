const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const logger = require('../services/Logger');

class ProcessManager {
    constructor() {
        this.services = new Map(); // Map<id, ServiceState>
        this.globalClients = new Set(); // SSE Clients
    }

    isWindows() { return os.platform() === "win32"; }

    getMavenCmd(cwd) {
        if (this.isWindows()) {
            const mvnw = path.join(cwd, "mvnw.cmd");
            return fs.existsSync(mvnw) ? mvnw : "mvn";
        }
        const mvnw = path.join(cwd, "mvnw");
        return fs.existsSync(mvnw) ? "./mvnw" : "mvn";
    }

    getNpmCmd() { return this.isWindows() ? "npm.cmd" : "npm"; }

    broadcastGlobal(msg, level = "INFO") {
        const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
        const payload = JSON.stringify({ ts, msg, level });
        for (const res of this.globalClients) {
            res.write(`data: ${payload}\n\n`);
        }
    }

    broadcastService(serviceId, line) {
        const svc = this.services.get(serviceId);
        if (!svc) return;

        // Strip ANSI escape codes and carriage returns
        const cleanLine = line.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '').replace(/\r/g, '');

        const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
        const entry = { ts, line: cleanLine };
        svc.logs.push(entry);
        if (svc.logs.length > 2000) svc.logs = svc.logs.slice(-2000);

        const payload = JSON.stringify(entry);
        for (const res of svc.sseClients) {
            res.write(`data: ${payload}\n\n`);
        }
        
        // Broadcast to global console as well
        this.broadcastGlobal(`[${svc.label}] ${cleanLine}`, "LOG");
    }

    setStatus(serviceId, running, pid = null) {
        const svc = this.services.get(serviceId);
        if (!svc) return;
        svc.running = running;
        svc.pid = running && svc.process ? svc.process.pid : pid;

        this.broadcastGlobal(
            running ? `▶  ${serviceId} started (PID ${svc.pid})` : `■  ${serviceId} stopped`,
            running ? "START" : "STOP"
        );

        const statusPayload = JSON.stringify({ serviceId, running, pid: svc.pid });
        for (const res of this.globalClients) {
            res.write(`event: status\ndata: ${statusPayload}\n\n`);
        }
    }

    ensureService(svcDef) {
        if (!this.services.has(svcDef.id)) {
            this.services.set(svcDef.id, {
                ...svcDef,
                process: null, running: false, pid: null,
                logs: [], sseClients: new Set(),
            });
        } else {
            const existing = this.services.get(svcDef.id);
            Object.assign(existing, { label: svcDef.label, type: svcDef.type, color: svcDef.color, order: svcDef.order });
        }
    }

    start(id, config, opts = {}) {
        logger.debug(`Attempting to start service: ${id}`, opts);
        const svc = this.services.get(id);
        if (!svc || svc.running) return;

        const { cleanInstall = false, npmInstall = false } = opts;
        let cmd, args, cwd;

        if (svc.type === "maven") {
            if (!config.backendRoot) return;
            cwd = path.join(config.backendRoot, id);
            if (!fs.existsSync(cwd)) { this.broadcastGlobal(`⚠  Path not found: ${cwd}`, "WARN"); return; }

            const mvn = this.getMavenCmd(cwd);
            args = cleanInstall ? ["clean", "install", "-DskipTests", "spring-boot:run"] : ["spring-boot:run"];
            cmd = this.isWindows() ? "cmd" : mvn;
            if (this.isWindows()) args = ["/c", mvn, ...args];
        } else if (svc.type === "node") {
            if (!config.frontendRoot) return;
            cwd = config.frontendRoot;
            cmd = this.getNpmCmd();
            args = ["run", svc.npm_script || "dev"];
        } else return;

        if (svc.type === "node" && npmInstall) {
            this.broadcastGlobal(`📦 Running npm install for ${svc.label}…`, "INFO");
            const installProc = spawn(this.getNpmCmd(), ["install"], { cwd, shell: this.isWindows(), stdio: ["ignore", "pipe", "pipe"] });
            installProc.stdout.on("data", d => {
                const lines = d.toString().split(/\r?\n/);
                if (lines[lines.length - 1] === "") lines.pop();
                lines.forEach(l => this.broadcastService(id, l));
            });
            installProc.stderr.on("data", d => {
                const lines = d.toString().split(/\r?\n/);
                if (lines[lines.length - 1] === "") lines.pop();
                lines.forEach(l => this.broadcastService(id, l));
            });
            installProc.on("close", () => {
                svc.logs = []; // Clear logs before launch after install
                this.launch(svc, cmd, args, cwd)
            });
        } else {
            svc.logs = []; // Clear logs before launch
            this.launch(svc, cmd, args, cwd);
        }
    }

    launch(svc, cmd, args, cwd) {
        logger.debug(`Launching process: ${cmd} ${args.join(' ')} (CWD: ${cwd})`);
        try {
            const proc = spawn(cmd, args, { cwd, shell: this.isWindows(), stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
            svc.process = proc;
            this.setStatus(svc.id, true);

            proc.stdout.on("data", data => {
                const lines = data.toString().split(/\r?\n/);
                if (lines[lines.length - 1] === "") lines.pop();
                lines.forEach(l => this.broadcastService(svc.id, l));
            });
            proc.stderr.on("data", data => {
                const lines = data.toString().split(/\r?\n/);
                if (lines[lines.length - 1] === "") lines.pop();
                lines.forEach(l => this.broadcastService(svc.id, l));
            });

            proc.on("close", (code) => {
                this.broadcastGlobal(`${svc.running ? "■" : "✓"}  ${svc.label} exited (code ${code ?? "?"})`, svc.running ? "WARN" : "INFO");
                svc.process = null;
                this.setStatus(svc.id, false);
            });
        } catch (e) {
            this.broadcastGlobal(`⚠  Failed to start ${svc.label}: ${e.message}`, "WARN");
        }
    }

    stop(id) {
        const svc = this.services.get(id);
        if (!svc || !svc.process) return;
        this.killProcess(svc.process.pid);
        this.setStatus(id, false);
    }

    async getPidOnPort(port) {
        if (!port) return null;
        logger.debug(`Checking PID on port: ${port}`);
        return new Promise((resolve) => {
            const cmd = this.isWindows() 
                ? `netstat -ano | findstr :${port}` 
                : `lsof -i :${port} -t`;
            
            const proc = spawn(this.isWindows() ? "cmd" : "sh", [this.isWindows() ? "/c" : "-c", cmd]);
            let output = "";
            proc.stdout.on("data", d => output += d.toString());
            proc.on("close", () => {
                if (!output) {
                    logger.debug(`No PID found on port ${port}`);
                    return resolve(null);
                }
                if (this.isWindows()) {
                    // Windows output is like:  TCP    0.0.0.0:8080           0.0.0.0:0              LISTENING       1234
                    const lines = output.split("\n").filter(l => l.includes("LISTENING"));
                    if (lines.length > 0) {
                        const parts = lines[0].trim().split(/\s+/);
                        const rawPid = parts[parts.length - 1];
                        return resolve(rawPid ? rawPid.trim() : null);
                    }
                    resolve(null);
                } else {
                    resolve(output.trim().split("\n")[0]);
                }
            });
        });
    }

    async killProcess(pid) {
        if (!pid) return Promise.resolve(false);
        return new Promise((resolve) => {
            try {
                if (this.isWindows()) {
                    const proc = spawn("taskkill", ["/F", "/T", "/PID", String(pid)], { shell: true });
                    proc.on("close", () => resolve(true));
                    proc.on("error", (e) => {
                        console.error(`Failed to execute taskkill for ${pid}:`, e.message);
                        resolve(false);
                    });
                } else {
                    process.kill(pid, "SIGKILL");
                    resolve(true);
                }
            } catch (e) {
                console.error(`Failed to kill process ${pid}:`, e.message);
                resolve(false);
            }
        });
    }

    async nukeAll(serviceList) {
        logger.info("☢ Starting global nuke operation...");
        let killedCount = 0;
        for (const svcDef of serviceList) {
            if (!svcDef.port) continue;
            const pid = await this.getPidOnPort(svcDef.port);
            if (pid) {
                logger.debug(`Nuking PID ${pid} on port ${svcDef.port} (${svcDef.label})`);
                const success = await this.killProcess(pid);
                if (success) {
                    killedCount++;
                    this.broadcastGlobal(`☢ Nuked block on port ${svcDef.port} (PID ${pid})`, "WARN");
                }
            }
        }
        logger.info(`Nuke operation complete. ${killedCount} process(es) terminated.`);
        return killedCount;
    }
}

module.exports = ProcessManager;
