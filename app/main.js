import { app, BrowserWindow, ipcMain, nativeTheme, Menu } from 'electron';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
const createWindow = () => {
    mainWindow = new BrowserWindow({
        width: 1920,
        height: 1080,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false, // Security: do not enable Node.js integration
            contextIsolation: true, // Security: enable context isolation
            enableRemoteModule: false // Security: do not enable remote module
        }
    });

    mainWindow.loadFile('index.html');

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


async function updateHistoryIndex(sessionID) {
    try {
        const filePath = path.join(__dirname, 'history/history-index.json');

        let data = await readHistoryFile(filePath);

        let newEntry = data.find(entry => entry.sessionID === sessionID);
        if (newEntry) {
            newEntry.lastUpdated = new Date().toISOString();
        } else {
            data.push({ sessionID: sessionID, lastUpdated: new Date().toISOString() });
        }

        // Sort by lastUpdated descending
        data.sort((a, b) =>
            new Date(b.lastUpdated) - new Date(a.lastUpdated)
        );

        await fs.promises.writeFile(filePath, JSON.stringify(data, null, 4), 'utf-8');
    } catch (error) {
        console.error('Error updating history index:', error);
    }
}

async function readHistoryFile(filePath) {
    let data = [];

    try {
        const file = await fs.promises.readFile(filePath, 'utf-8');
        data = JSON.parse(file);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error('Error reading history file:', error);
        }
    }

    return data;
}

async function writeHistoryFile(sessionID, history) {
    updateHistoryIndex(sessionID);

    try {
        const filePath = path.join(__dirname, `history/chats/${sessionID}.json`);

        let data = await readHistoryFile(filePath);

        data.push(history);

        await fs.promises.writeFile(filePath, JSON.stringify(data, null, 4), 'utf-8');
        console.log('History written successfully for session:', sessionID);
    } catch (error) {
        console.error('Error writing history file:', error);
    }
}

ipcMain.handle('history:read', (event, filePath) => {
    return readHistoryFile(filePath);
});

ipcMain.handle('history:write', (event, sessionID, history) => {
    writeHistoryFile(sessionID, history);
});