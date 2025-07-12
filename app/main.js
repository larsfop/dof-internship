import { app, BrowserWindow, ipcMain, nativeTheme } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log(__dirname)
ipcMain.handle('get-app-path', () => {
    return __dirname; // Return the directory of the main.js file
});

let connection;
let db_tables;

const createWindow = () => {
    const win = new BrowserWindow({
        width: 1920,
        height: 1080,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false, // Security: do not enable Node.js integration
            contextIsolation: true, // Security: enable context isolation
            enableRemoteModule: false // Security: do not enable remote module
        }
    });

    win.loadFile('index.html');

    // Connect to MySQL after window is created
    try {
        connection = mysql.createConnection({
            host: '192.168.0.41',
            user: 'lars',
            password: 'Lilleaker01', // set your password
            database: 'tables' // set your database
        });
        console.log('Connected to MySQL database');
        connection.query('SHOW TABLES', (error, results) => {
            if (error) {
                console.error('Error fetching tables:', error);
            } else {
                db_tables = results.map(row => Object.values(row)[0]); // Extract table names
                console.log('Tables:', db_tables);

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

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
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
                resolve({ success: false, message: error.message }); // Resolve with error message
            } else {
                console.log(results);
                resolve({ success: true, results }); // Resolve with query results
            }
        });
    });
});
