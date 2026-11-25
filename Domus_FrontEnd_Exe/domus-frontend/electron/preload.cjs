const { contextBridge, ipcRenderer } = require('electron');

// Expõe window.__electronLog (info/warn/error/...) no renderer. As chamadas
// viajam por IPC até o main process e caem no mesmo log.transports.file
// configurado em main.cjs. Consumido por src/lib/logger.ts.
require('electron-log/preload');

// A sessão do Supabase nunca é exposta ao Node do renderer: somente as três
// operações de armazenamento, limitadas a uma chave interna, cruzam esta ponte.
contextBridge.exposeInMainWorld('domusDesktop', {
  isElectron: true,
  platform: process.platform,
  sessionStorage: {
    get: () => ipcRenderer.invoke('domus:session:get', 'supabase.auth.token'),
    set: (_key, value) => ipcRenderer.invoke('domus:session:set', 'supabase.auth.token', value),
    remove: () => ipcRenderer.invoke('domus:session:remove', 'supabase.auth.token'),
  },
});
