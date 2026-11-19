const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('node:path');
const log = require('electron-log/main');

// Precisa bater com uma origem já liberada em SecurityConfig#corsConfigurationSource
// no backend (allowedOriginPatterns inclui "http://localhost:5173"). Não mude sem
// também atualizar o CORS do backend.
const PORT = 5173;
const isDev = !app.isPackaged;

// log.initialize() liga o transporte IPC: chamadas de log feitas no renderer
// (via window.__electronLog, exposto pelo preload) chegam até aqui e caem no
// mesmo arquivo. Local do arquivo no Windows:
// %USERPROFILE%\AppData\Roaming\Domus\logs\main.log
log.initialize();
log.transports.file.level = 'info';
log.transports.console.level = isDev ? 'debug' : 'info';

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#0f172a',
    icon: path.join(__dirname, '..', 'public', 'logo_domus.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (!isDev) {
    Menu.setApplicationMenu(null);
  }

  mainWindow.loadURL(`http://localhost:${PORT}`);

  // Links externos (ex.: target="_blank") abrem no navegador padrão, não numa nova janela do app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Em produção não existe "vite dev server": subimos um servidor estático local
// servindo o build (dist/) na mesma porta que o backend já libera via CORS.
function startStaticServer() {
  if (isDev) return Promise.resolve();

  const sirv = require('sirv');
  const { createServer } = require('node:http');

  const distPath = path.join(__dirname, '..', 'dist');
  const serve = sirv(distPath, { single: true, dev: false });
  const server = createServer((req, res) => serve(req, res));

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(PORT, '127.0.0.1', resolve);
  });
}

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    log.info(`Domus iniciando (isDev=${isDev}, versão=${app.getVersion()})`);

    try {
      await startStaticServer();
    } catch (err) {
      log.error('Falha ao iniciar o servidor estático local:', err);
      dialog.showErrorBox(
        'Domus não conseguiu iniciar',
        `Não foi possível abrir o servidor local na porta ${PORT}. ` +
          'Feche outras instâncias do Domus ou processos usando essa porta e tente novamente.\n\n' +
          String(err)
      );
      app.quit();
      return;
    }

    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
