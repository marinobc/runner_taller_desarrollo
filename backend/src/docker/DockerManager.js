const { execSync } = require('child_process');
const logger = require('../services/Logger');

const isWindows = process.platform === 'win32';

class DockerManager {
    constructor() {
        this.dockerAvailable = null;
    }

    async checkDocker() {
        try {
            execSync('docker --version', { stdio: 'pipe', timeout: 5000 });
            this.dockerAvailable = true;
            return { available: true };
        } catch (e) {
            this.dockerAvailable = false;
            return { available: false, error: 'Docker is not installed or not in PATH' };
        }
    }

    _exec(cmd, options = {}) {
        try {
            const result = execSync(cmd, {
                encoding: 'utf-8',
                stdio: ['pipe', 'pipe', 'pipe'],
                timeout: options.timeout || 30000,
                ...options
            });
            return { ok: true, output: result.trim() };
        } catch (e) {
            return {
                ok: false,
                error: e.stderr?.trim() || e.message,
                output: e.stdout?.trim() || ''
            };
        }
    }

    _escapeName(name) {
        return isWindows ? `"${name}"` : name;
    }

    async listContainers(all = true) {
        const flag = all ? '-a' : '';
        const result = this._exec(`docker ps ${flag} --format "{{.ID}}~{{.Names}}~{{.Status}}~{{.Ports}}~{{.Image}}"`);
        if (!result.ok) {
            logger.error(`Failed to list containers: ${result.error}`);
            return { ok: false, error: result.error, containers: [] };
        }

        const lines = result.output.split('\n').filter(Boolean);
        const containers = [];

        for (const line of lines) {
            const parts = line.split('~');
            if (parts.length >= 5) {
                containers.push({
                    id: parts[0],
                    name: parts[1],
                    status: parts[2],
                    ports: parts[3],
                    image: parts[4]
                });
            }
        }

        return { ok: true, containers };
    }

    async getContainerStatus(name) {
        const result = this._exec(`docker ps -a --filter "name=^${name}$" --format "{{.ID}}~{{.Status}}"`);
        if (!result.ok) return { ok: false, error: result.error };

        if (!result.output) {
            return { ok: true, running: false, name };
        }

        const parts = result.output.split('~');
        const isRunning = parts[1]?.toLowerCase().includes('up');
        return {
            ok: true,
            running: isRunning,
            id: parts[0],
            status: parts[1],
            name
        };
    }

    async getServiceStatus(serviceId) {
        // serviceId can be a service id (like 'mongodb') or a container name
        let name = serviceId;

        // If it's a service object, extract the name
        if (typeof serviceId === 'object' && serviceId.name) {
            name = serviceId.name;
        }

        return await this.getContainerStatus(name);
    }

    async startService(svc) {
        const name = svc.name;

        // Check if container exists
        const existing = await this.getContainerStatus(name);
        if (!existing.ok) return existing;

        if (existing.running) {
            return { ok: true, message: 'Already running', name };
        }

        if (existing.id) {
            // Container exists but stopped — just start it
            const result = this._exec(`docker start ${this._escapeName(name)}`);
            if (!result.ok) return { ok: false, error: result.error };
            logger.info(`  ✓ Started existing container: ${name}`);
            return { ok: true, action: 'started', name };
        }

        // Container doesn't exist — create and run
        let cmd = `docker run --name ${this._escapeName(name)} -d`;
        for (const p of svc.ports) cmd += ` -p ${p.host}:${p.container || p.host}`;
        for (const v of (svc.volumes || [])) cmd += ` -v ${v}`;
        for (const e of (svc.env || [])) cmd += ` -e ${e}`;
        if (svc.runOptions) cmd += ` ${svc.runOptions.join(' ')}`;
        cmd += ` ${svc.image}`;
        if (svc.command) cmd += ` ${svc.command.join(' ')}`;

        const conflicts = await this.checkConflicts(svc);
        if (conflicts.length > 0) {
            return { ok: false, error: 'Port conflicts', conflicts };
        }

        // Create and run
        const result = this._exec(cmd, { timeout: 120000 });
        if (!result.ok) return { ok: false, error: result.error };

        logger.info(`  ✓ Created and started container: ${name} (${result.output})`);
        return { ok: true, action: 'created', name, containerId: result.output };
    }

    async stopService(name) {
        const result = this._exec(`docker stop ${this._escapeName(name)}`, { timeout: 30000 });
        if (!result.ok) return { ok: false, error: result.error };
        logger.info(`  ✓ Stopped container: ${name}`);
        return { ok: true, action: 'stopped', name };
    }

    async removeContainerOnly(name) {
        const results = [];

        // Stop if running
        const status = await this.getContainerStatus(name);
        if (status.ok && status.running) {
            const stopResult = this._exec(`docker stop ${this._escapeName(name)}`);
            if (!stopResult.ok) return { ok: false, error: `Failed to stop: ${stopResult.error}` };
            results.push({ action: 'stopped', ok: true });
        }

        // Remove container
        const rmResult = this._exec(`docker rm ${this._escapeName(name)}`);
        if (rmResult.ok) {
            results.push({ action: 'container removed', ok: true });
            logger.info(`  ✓ Removed container: ${name}`);
        } else if (!rmResult.error.includes('No such container')) {
            return { ok: false, error: `Failed to remove container: ${rmResult.error}` };
        }

        return { ok: true, results };
    }

    async removeVolumes(svc) {
        const results = [];
        for (const vol of (svc.volumes || [])) {
            const volName = vol.split(':')[0];
            if (volName.includes('/') || volName.includes('~')) continue;
            const volRm = this._exec(`docker volume rm -f ${volName}`);
            results.push({
                volume: volName,
                ok: volRm.ok,
                error: volRm.error
            });
            if (volRm.ok) logger.info(`  ✓ Removed volume: ${volName}`);
        }
        return { ok: true, results };
    }

    async removeImage(svc) {
        const results = [];

        // Stop and remove container first
        const containerResult = await this.removeContainerOnly(svc.name);
        results.push(...(containerResult.results || []));

        if (!containerResult.ok) {
            results.push({ action: 'container removal failed', ok: false, error: containerResult.error });
        }

        // Remove volumes
        const volResult = await this.removeVolumes(svc);
        results.push(...(volResult.results || []));

        // Remove image
        const imgRm = this._exec(`docker rmi -f ${svc.image}`);
        results.push({
            action: `image '${svc.image}' removal`,
            ok: imgRm.ok,
            error: imgRm.error
        });
        if (imgRm.ok) logger.info(`  ✓ Removed image: ${svc.image}`);

        return { ok: true, results };
    }

    async checkConflicts(svc) {
        const conflicts = [];
        for (const p of svc.ports) {
            const result = this._exec(`netstat -ano | findstr :${p.host}`);
            if (result.output) {
                // Only consider LISTENING ports as real conflicts
                const listeningLines = result.output.split('\n').filter(line =>
                    line.includes('LISTENING')
                );
                if (listeningLines.length > 0) {
                    conflicts.push({ port: p.host, details: listeningLines[0] });
                }
            }
        }
        return conflicts;
    }

    async getLogs(name, tail = 100) {
        const result = this._exec(`docker logs --tail ${tail} ${this._escapeName(name)}`);
        return {
            ok: result.ok,
            logs: result.output || result.error || '(no logs)',
            name
        };
    }

    async removeAllConflictingContainers(svc) {
        const results = [];

        // Find containers with same name
        const sameName = this._exec(`docker ps -a --filter "name=^${svc.name}$" --format '{{.ID}}|||{{.Names}}'`);
        if (sameName.output) {
            const lines = sameName.output.split('\n').filter(Boolean);
            for (const line of lines) {
                const [id, name] = line.split('|||');
                const rmResult = this._exec(`docker rm -f ${id}`);
                results.push({
                    action: `removed '${name}'`,
                    ok: rmResult.ok,
                    error: rmResult.error
                });
            }
        }

        // Find containers with conflicting ports
        for (const p of svc.ports) {
            const portResult = this._exec(`docker ps -a --filter "publish=${p.host}" --format '{{.ID}}|||{{.Names}}'`);
            if (portResult.output) {
                const lines = portResult.output.split('\n').filter(Boolean);
                for (const line of lines) {
                    const [id, name] = line.split('|||');
                    if (name !== svc.name) {
                        const rmResult = this._exec(`docker rm -f ${id}`);
                        results.push({
                            action: `removed conflicting '${name}' (port ${p.host})`,
                            ok: rmResult.ok,
                            error: rmResult.error
                        });
                    }
                }
            }
        }

        return { ok: true, results };
    }
}

module.exports = DockerManager;
