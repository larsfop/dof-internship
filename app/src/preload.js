const { contextBridge, ipcRenderer, webUtils } = require('electron/renderer')


contextBridge.exposeInMainWorld('app', {
  main: {
    setTheme: (theme) => ipcRenderer.invoke('main:set-theme', theme)
  }
});