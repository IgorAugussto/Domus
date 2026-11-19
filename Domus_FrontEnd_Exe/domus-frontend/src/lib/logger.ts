type LogFn = (...args: unknown[]) => void;

interface ElectronLog {
  error: LogFn;
  warn: LogFn;
  info: LogFn;
  verbose: LogFn;
  debug: LogFn;
  silly: LogFn;
}

declare global {
  interface Window {
    __electronLog?: ElectronLog;
  }
}

// window.__electronLog só existe quando rodando dentro do Electron (exposto
// pelo preload.cjs via require('electron-log/preload')). Na versão web
// (navegador acessando via CloudFront) ele é undefined e caímos no console.
const electronLog = typeof window !== "undefined" ? window.__electronLog : undefined;

const logger = {
  error: (...args: unknown[]) => (electronLog ? electronLog.error(...args) : console.error(...args)),
  warn: (...args: unknown[]) => (electronLog ? electronLog.warn(...args) : console.warn(...args)),
  info: (...args: unknown[]) => (electronLog ? electronLog.info(...args) : console.info(...args)),
  debug: (...args: unknown[]) => (electronLog ? electronLog.debug(...args) : console.debug(...args)),
};

export default logger;
