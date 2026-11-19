const { contextBridge } = require('electron');

// Expõe window.__electronLog (info/warn/error/...) no renderer. As chamadas
// viajam por IPC até o main process e caem no mesmo log.transports.file
// configurado em main.cjs. Consumido por src/lib/logger.ts.
require('electron-log/preload');

// contextIsolation está ativo (webPreferences em main.cjs), então o renderer
// só enxerga o que for exposto explicitamente aqui. Nada de IPC próprio por
// enquanto — o app fala com a API só via HTTPS (axios), como já fazia na
// versão web.
contextBridge.exposeInMainWorld('domusDesktop', {
  isElectron: true,
  platform: process.platform,
});
