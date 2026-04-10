class Logger {
    constructor() {
        this.enabled = false;
    }

    setEnabled(val) {
        this.enabled = !!val;
    }

    debug(msg, ...args) {
        if (!this.enabled) return;
        const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
        console.log(`\x1b[36m[DEBUG ${ts}]\x1b[0m ${msg}`, ...args);
    }

    info(msg, ...args) {
        const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
        console.log(`\x1b[32m[INFO  ${ts}]\x1b[0m ${msg}`, ...args);
    }

    warn(msg, ...args) {
        const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
        console.warn(`\x1b[33m[WARN  ${ts}]\x1b[0m ${msg}`, ...args);
    }

    error(msg, ...args) {
        const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
        console.error(`\x1b[31m[ERROR ${ts}]\x1b[0m ${msg}`, ...args);
    }
}

module.exports = new Logger();
