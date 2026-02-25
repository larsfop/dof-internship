import { app, BrowserWindow, ipcMain, nativeTheme, Menu } from 'electron';

let mainWindow;
const createWindow = () => {
    mainWindow = new BrowserWindow({
        width: 1920,
        height: 1080,
        webPreferences: {
            nodeIntegration: false, // Security: do not enable Node.js integration
            contextIsolation: true, // Security: enable context isolation
            enableRemoteModule: false // Security: do not enable remote module
        }
    });

    mainWindow.loadFile('src/index.html');

    ipcMain.handle('dark-mode:toggle', () => {
        if (nativeTheme.shouldUseDarkColors) {
            nativeTheme.themeSource = 'light';
        } else {
            nativeTheme.themeSource = 'dark';
        }
        return nativeTheme.shouldUseDarkColors;
    });

    ipcMain.handle('dark-mode:system', () => {
        nativeTheme.themeSource = 'system';
    });
};

app.disableHardwareAcceleration();
app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });

    const menu = Menu.buildFromTemplate([
        {
            label: 'File',
            submenu: [
                { label: 'Exit', role: 'quit' }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { type: 'separator' },
                { role: 'selectAll' },
                { type: 'separator' },
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                {
                    label: 'Toggle dark/light mode',
                    click: () => {
                        nativeTheme.themeSource = nativeTheme.shouldUseDarkColors ? 'light' : 'dark';
                    }
                }
            ]
        },
        {
            label: 'Window',
            submenu: [
                { role: 'minimize' },
                { role: 'zoom' },
                { role: 'close' },
            ]
        }
    ]);

    Menu.setApplicationMenu(menu);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

ipcMain.handle('main:set-theme', (event, theme) => {
    nativeTheme.themeSource = theme;
    return nativeTheme.shouldUseDarkColors;
});