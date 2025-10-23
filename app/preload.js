const { contextBridge, ipcRenderer, webUtils } = require('electron/renderer')


contextBridge.exposeInMainWorld('app', {
  darkMode: {
    toggle: () => ipcRenderer.invoke('dark-mode:toggle'),
    system: () => ipcRenderer.invoke('dark-mode:system')
  },
  history: {
    read: (filePath) => ipcRenderer.invoke('history:read', filePath),
    write: (sessionID, history) => ipcRenderer.invoke('history:write', sessionID, history)
  }
});