const { contextBridge, ipcRenderer, webUtils } = require('electron/renderer')


contextBridge.exposeInMainWorld('darkMode', {
  toggle: () => ipcRenderer.invoke('dark-mode:toggle'),
  system: () => ipcRenderer.invoke('dark-mode:system')
})

contextBridge.exposeInMainWorld('database', {
    queryTable: (query) => ipcRenderer.invoke('db:query', query),
    getTables: () => ipcRenderer.invoke('get-db-tables')
})

contextBridge.exposeInMainWorld('paths', {
    appPath: () => ipcRenderer.invoke('get-app-path'),
})

contextBridge.exposeInMainWorld('file', {
    getPath: (file) => {
      return webUtils.getPathForFile(file)
    }
})