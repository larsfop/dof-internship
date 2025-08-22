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

contextBridge.exposeInMainWorld('dropbox', {
    getPdfLink: (filePath) => ipcRenderer.invoke('get-pdf-link', filePath),
    authSuccess: (resolve, window) => ipcRenderer.once('authorised', (event, token) => {
        if (window) {
            window.close();
        }
        resolve(token);
    })
});

contextBridge.exposeInMainWorld('openAI', {
    vectorSearch: (query) => ipcRenderer.invoke('vector-search', query),
    // query: (query, docs) => ipcRenderer.invoke('chat-query', query, docs),
    query: (query, docs) => ipcRenderer.send('gpt-query', { query, docs }),
    stream: (callback) => ipcRenderer.on('gpt-stream', (event, data) => {
        callback(data);
    }),
    done: (callback) => ipcRenderer.on('gpt-done', (event, data) => {
        callback(data);
    }),
    completed: (callback) => ipcRenderer.on('gpt-completed', (event, data) => {
        callback(data);
    }),
    created: (callback) => ipcRenderer.on('gpt-created', (event, data) => {
        callback(data);
    }),
    removeListeners: () => {
        ipcRenderer.removeAllListeners('gpt-stream');
        ipcRenderer.removeAllListeners('gpt-done');
        ipcRenderer.removeAllListeners('gpt-completed');
        ipcRenderer.removeAllListeners('gpt-created');
    }
});

contextBridge.exposeInMainWorld('marked', {
    markdownToHtml: (markdown) => ipcRenderer.invoke('markdown-render', markdown)
});