import { app, BrowserWindow, ipcMain, nativeTheme, Menu } from 'electron';
import express from 'express';
import fetch from 'node-fetch';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2';
import mupdf from 'mupdf';
import Dropbox from 'dropbox';
import { arrayBufferToBinaryString } from 'blob-util'
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log(__dirname)
ipcMain.handle('get-app-path', () => {
    return __dirname; // Return the directory of the main.js file
});

const authApp = express();
const hostName = 'localhost';
const port = 3000;
let dropboxAccessToken = null;
let dbx;
let connection;
let db_tables;
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

    // Read and parse MySQL connection details from mysql_connection.json
    const mysqlConfigPath = path.join(__dirname, '../mysql_connection.json');
    const file = fs.readFileSync(mysqlConfigPath, 'utf-8');
    const config = JSON.parse(file);
    // Connect to MySQL after window is created
    try {
        connection = mysql.createConnection(config.user);
        console.log('Connected to MySQL database');
        connection.query('SHOW TABLES', (error, results) => {
            if (error) {
                console.error('Error fetching tables:', error);
            } else {
                db_tables = results.map(row => Object.values(row)[0]); // Extract table names
                console.log('Database tables:', db_tables);

                // Expose tables to renderer process for autocompletion
                ipcMain.handle('get-db-tables', () => db_tables);
            }
        });
    } catch (err) {
        console.error('MySQL connection error:', err.message);
    }

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

async function getPdfLink (event, filePath) {
    return new Promise((resolve, reject) => {
        const pdfLink = dbx.filesDownload({
            path: filePath
        }).then(response => {
            console.log('pdf-response', response.result)
            const blob = response.result.fileBlob;
            console.log(arrayBufferToBinaryString('blob', blob));

            resolve(arrayBufferToBinaryString(blob));
        }).catch(error => {
            console.error('Error downloading PDF:', error);
            throw error;
        });
    })
}

const dbxAuth = new Dropbox.DropboxAuth({
    clientId: '25qnd8cmj0jv2vv',
});

const redirectUri = `http://${hostName}:${port}/auth`;

authApp.get('/', (req, res) => {
    dbxAuth.getAuthenticationUrl(redirectUri, null, 'code', 'offline', null, 'none', true)
        .then((authUrl) => {
            res.writeHead(302, { Location: authUrl });
            res.end();
        });
});

authApp.get('/auth', (req, res) => { // eslint-disable-line no-unused-vars
    const { code } = req.query;

    dbxAuth.getAccessTokenFromCode(redirectUri, code)
        .then((token) => {
            if (mainWindow) {
                mainWindow.webContents.send('authorised', token.result.access_token);
            }

            dbxAuth.setRefreshToken(token.result.refresh_token);

            /*
            const dbx = new Dropbox.Dropbox({
                auth = dbxAuth
            });
            dbx.usersGetCurrentAccount()
                .then((account) => {
                    console.log(account);
                })
                .catch((error) => {
                    console.error('Error getting account info:', error);
                });*/

            // ipcMain.handle('get-pdf-link', getPdfLink);
        })
        .catch((error) => {
            console.error(error);
        });
    res.end();
});

authApp.listen(port);

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
                { role: 'selectAll' }
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
    if (connection) connection.end();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Handle chatbox SQL query
ipcMain.handle('db:query', async (event, query) => {
    if (!connection) {
        return { success: false, message: 'No database connection.' };
    }
    return new Promise((resolve, reject) => {
        connection.query(query, (error, results) => {
            if (error) {
                console.error('Error executing query:', error);
                resolve(error.message); // Resolve with error message
            } else {
                console.log(results);
                resolve(results); // Resolve with query results
            }
        });
    });
});

