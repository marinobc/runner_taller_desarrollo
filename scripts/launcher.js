// scripts/launcher.js
const { spawn, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const isWindows = process.platform === 'win32';
const rootDir = path.join(__dirname, '..');

// Logger helper
const log = (prefix, color, message) => {
    const reset = '\x1b[0m';
    const bright = '\x1b[1m';
    console.log(`${color}${bright}[${prefix}]${reset} ${message}`);
};

// Colors for console
const colors = {
    backend: '\x1b[36m', // Cyan
    frontend: '\x1b[35m', // Magenta
    system: '\x1b[33m', // Yellow
    error: '\x1b[31m'  // Red
};

// Track children for cleanup
const children = [];

const cleanup = () => {
    log('SYSTEM', colors.system, 'Shutting down services...');
    children.forEach(p => {
        try {
            if (isWindows) {
                spawn('taskkill', ['/pid', p.pid, '/f', '/t']);
            } else {
                process.kill(-p.pid, 'SIGTERM');
            }
        } catch (e) {
            // Process might already be dead
        }
    });
    process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// --- Helper to ensure dependencies exist ---
const ensureDeps = (projectName, projectPath) => {
    const pkgPath = path.join(projectPath, 'package.json');
    const lockPath = path.join(projectPath, 'package-lock.json');
    const nodeModulesPath = path.join(projectPath, 'node_modules');
    const markerPath = path.join(nodeModulesPath, '.last-install');
    
    let needsInstall = false;

    if (!fs.existsSync(nodeModulesPath)) {
        needsInstall = true;
    } else if (fs.existsSync(pkgPath)) {
        const pkgStat = fs.statSync(pkgPath);
        const lockStat = fs.existsSync(lockPath) ? fs.statSync(lockPath) : null;
        
        if (!fs.existsSync(markerPath)) {
            // No marker, but node_modules exists. Could be a fresh git pull or manual copy.
            // Be safe and install.
            needsInstall = true; 
        } else {
            const markerStat = fs.statSync(markerPath);
            // If package.json or package-lock.json is newer than our last recorded install, we need an update
            if (pkgStat.mtime > markerStat.mtime) needsInstall = true;
            if (lockStat && lockStat.mtime > markerStat.mtime) needsInstall = true;
        }
    }

    if (needsInstall) {
        log('SYSTEM', colors.system, `Changes detected in ${projectName} dependencies. Updating...`);
        
        const npmCmd = isWindows ? 'npm.cmd' : 'npm';
        const result = spawnSync(`${npmCmd} install`, { 
            cwd: projectPath, 
            stdio: 'inherit', // Pipe output directly to console
            shell: true 
        });

        if (result.status !== 0) {
            log('ERROR', colors.error, `Failed to install dependencies for ${projectName}. Exiting.`);
            process.exit(1);
        }

        // Create or update the marker inside node_modules
        if (!fs.existsSync(nodeModulesPath)) fs.mkdirSync(nodeModulesPath, { recursive: true });
        fs.writeFileSync(markerPath, new Date().toISOString());
        
        log('SYSTEM', colors.system, `${projectName} dependencies are now up to date.`);
    }
};

// --- Pre-flight checks ---
ensureDeps('BACKEND', path.join(rootDir, 'backend'));
ensureDeps('FRONTEND', path.join(rootDir, 'frontend'));

// --- Start Backend ---
log('SYSTEM', colors.system, 'Starting Backend...');
const backendCwd = path.join(rootDir, 'backend');

const backend = spawn(
    isWindows ? 'node' : 'node',
    ['server.js'],
    { 
        cwd: backendCwd, 
        stdio: 'pipe', 
        shell: false, // Node is an exe, safe to run without shell
        detached: !isWindows 
    }
);

children.push(backend);
backend.stdout.on('data', (data) => data.toString().split('\n').forEach(l => l.trim() && log('BACKEND', colors.backend, l)));
backend.stderr.on('data', (data) => data.toString().split('\n').forEach(l => l.trim() && log('BACKEND', colors.error, l)));
backend.on('close', (code) => {
    log('BACKEND', colors.error, `Process exited with code ${code}`);
    if (code !== 0 && code !== null) cleanup();
});

// --- Start Frontend ---
log('SYSTEM', colors.system, 'Starting Frontend...');
const frontendCwd = path.join(rootDir, 'frontend');
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

const frontend = spawn(
    `${npmCmd} run dev`,
    { 
        cwd: frontendCwd, 
        stdio: 'pipe', 
        shell: true, // npm.cmd requires shell
        detached: !isWindows 
    }
);

children.push(frontend);
frontend.stdout.on('data', (data) => data.toString().split('\n').forEach(l => l.trim() && log('FRONTEND', colors.frontend, l)));
frontend.stderr.on('data', (data) => data.toString().split('\n').forEach(l => l.trim() && log('FRONTEND', colors.frontend, l)));
frontend.on('close', (code) => {
    log('FRONTEND', colors.error, `Process exited with code ${code}`);
    if (code !== 0 && code !== null) cleanup();
});