class Logger {
  enabled: boolean = false;

  constructor() {
    this.enabled = localStorage.getItem('debug-mode') === 'true';
  }

  setEnabled(val: boolean) {
    this.enabled = val;
    localStorage.setItem('debug-mode', val ? 'true' : 'false');
  }

  debug(msg: string, ...args: any[]) {
    if (!this.enabled) return;
    const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
    console.debug(`%c[DEBUG ${ts}]`, "color: #0ea5e9; font-weight: bold;", msg, ...args);
  }

  info(msg: string, ...args: any[]) {
    const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
    console.log(`%c[INFO  ${ts}]`, "color: #10b981; font-weight: bold;", msg, ...args);
  }

  warn(msg: string, ...args: any[]) {
    const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
    console.warn(`%c[WARN  ${ts}]`, "color: #f59e0b; font-weight: bold;", msg, ...args);
  }

  error(msg: string, ...args: any[]) {
    const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
    console.error(`%c[ERROR ${ts}]`, "color: #ef4444; font-weight: bold;", msg, ...args);
  }
}

export const logger = new Logger();
