import { app, BrowserWindow, ipcMain, nativeTheme, Menu } from 'electron';
import express from 'express';
import fetch from 'node-fetch';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2';
import mupdf from 'mupdf';
import openAI from 'openai';
import Dropbox from 'dropbox';
import { createClient } from 'redis';
import { arrayBufferToBinaryString } from 'blob-util'
import fs from 'fs';
import { marked } from 'marked';
import dotenv from 'dotenv/config';

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
let AIModel = 'gpt-4.1';
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

const openai = new openAI({
    apiKey: process.env.OPENAI_API_KEY
})

const redisClient = createClient({
    url: 'redis://192.168.0.41:6379'
});

await redisClient.connect()

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
                { role: 'selectAll' },
                { type: 'separator' },
                { 
                    label: 'AI model',
                    submenu: [
                        { 
                            label: 'GPT-4.1', 
                            type: 'radio', 
                            checked: true,
                            click: () => {
                                AIModel = 'gpt-4.1';
                            }
                        },
                        { 
                            label: 'o4-mini', 
                            type: 'radio',
                            click: () => {
                                AIModel = 'o4-mini';
                            }
                        },
                        // { 
                        //     label: 'GPT-5', 
                        //     type: 'radio',
                        //     click: () => {
                        //         AIModel = 'gpt-5';
                        //     }
                        // }
                    ]
                }
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
    if (redisClient) {
        redisClient.quit();
    }
});

// Handle chatbox SQL query
ipcMain.handle('db:query', async (event, query) => {
    if (!connection) {
        return 'No database connection.';
    }
    return new Promise((resolve, reject) => {
        connection.query(query, (error, results) => {
            if (error) {
                console.error('Error executing query:', error);
                resolve(error.message); // Resolve with error message
            } else {
                resolve(results); // Resolve with query results
            }
        });
    });
});

ipcMain.handle('vector-search', async (event, query) => {
    if (!redisClient) {
        return 'No Redis client connected.';
    }

    const response = await openai.embeddings.create({
        model: 'text-embedding-3-large',
        input: query,
        // encoding_format: 'base64'
    });

    return new Promise((resolve, reject) => {
        redisClient.ft.search(
            'vector_index',
            '*=> [KNN 100 @embedding $vec AS score]',
            {
                PARAMS: {
                    'vec': Buffer.from(
                        new Float32Array(response.data[0].embedding).buffer
                    )
                },
                SORTBY: 'score',
                RETURN: ['document', 'start_page', 'end_page', 'score'],
                LIMIT: { from: 0, size: 100 },
                DIALECT: 2
            }
        ).then(results => {
            var embeds = []
            results.documents.forEach(doc => {
                embeds.push({
                    document: doc.value.document,
                    start_page: doc.value.start_page,
                    end_page: doc.value.end_page,
                    score: doc.value.score,
                });
            });

            resolve(embeds);
        }).catch(error => {
            console.error('Error executing vector search:', error);
                resolve(error.message);
            });
    });
});


class PDFCopy {
    constructor() {
        this.doc = new mupdf.PDFDocument();
        this.documentPageCopies = {};
    }

    graftPage(otherDoc, name, pageIndex) {
        pageIndex = Number(pageIndex);
        if (pageIndex < 0 || pageIndex >= otherDoc.countPages()) {
            throw new Error('Invalid page index');
        }
        if (!this.documentPageCopies[name]) {
            this.documentPageCopies[name] = [];
        }
        if (this.documentPageCopies[name].includes(pageIndex)) {
            console.warn(`Page ${pageIndex} from document ${name} is already grafted.`);
            return;
        }
        this.documentPageCopies[name].push(pageIndex);
        console.log(`Grafting page ${pageIndex} from document ${name}`);
        this.doc.graftPage(-1, otherDoc, pageIndex);
    }

    countPages() {
        return this.doc.countPages();
    }

    buffer() {
        return this.doc.saveToBuffer();
    }

    saveTmpDocument() {
        const tmpFilePath = path.join(__dirname, 'tmp.pdf');
        this.doc.save(tmpFilePath);
        return tmpFilePath;
    }
}

// ipcMain.handle('chat-query', async (event, query, docs) => {
ipcMain.on('gpt-query', async (event, { query, docs }) => {

    // Copy the required pages into a new document to be sent to the openAI API
    const doc = new PDFCopy();
    var pdfs = []
    for (const item of docs) {
        var pdf = pdfs[item.name];

        if (!pdf) {
            pdf = new mupdf.PDFDocument(Buffer.from(item.blob), 'application/pdf');
            pdfs[item.name] = pdf;
        }
        for (let i = item.pageStart; i < item.pageEnd + 1; i++) {
            doc.graftPage(pdf, item.name, i);
        }
    };

    // Save the pdf as tmp.pdf
    doc.saveTmpDocument();

    const file = await openai.files.create({
        file: fs.createReadStream('tmp.pdf'),
        purpose: 'user_data'
    });

    const stream = await openai.responses.create({
        model: AIModel,
        input: [
            {
                role: 'developer',
                content: 'Provide output in valid HTML only, no markdown, do not create a HTML style or title'
            },
            {
                role: 'user',
                content: [
                    {
                        type: 'input_file',
                        file_id: file.id
                    },
                    {
                        type: 'input_text',
                        text: query
                    }
                ]
            }
        ],
        stream: true
    });

    for await (const event of stream) {
        if (event.type === 'response.output_text.delta') {
            mainWindow.webContents.send('gpt-stream', event.delta);
        }
        else if (event.type === 'response.output_text.done') {
            mainWindow.webContents.send('gpt-done', event);
        }
        else if (event.type === 'response.completed') {
            mainWindow.webContents.send('gpt-completed', event);
        } else if (event.type === 'response.created') {
            mainWindow.webContents.send('gpt-created', event);
        } else {
            console.log(event.type);
        }
    }

})


ipcMain.handle('markdown-render', (event, markdown) => {
    const html = marked.parse(markdown);
    return html;
});