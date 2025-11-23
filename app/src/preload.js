const { contextBridge, ipcRenderer, webUtils } = require('electron/renderer')


contextBridge.exposeInMainWorld('app', {
  quit: () => ipcRenderer.invoke('app:quit'),
  ssh: {
    connect: (username, password) => ipcRenderer.invoke('ssh:connect', username, password)
  }
});