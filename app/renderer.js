import { Chatbox } from './content.js';
import { Pdf } from './pdf.js';
import { Layout } from './layout.js';
import { Dropbox } from './dropbox.js';

var _documents = {
    'EN_1992-1-1:2004': 'ns-en-1992-1-1_2004+a1_2014+na_2024_en_002.pdf',
}

async function getDropboxAccessToken() {
    return new Promise((resolve) => {
        const authWin = window.open('http://localhost:3000', '_blank');

        window.dropbox.authSuccess(resolve, authWin);
    });
}

// Chatbox and tabs logic for renderer process
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', async () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'node_modules/pdfjs-dist/build/pdf.worker.mjs'

        window.addEventListener('dragover', (e) => {
            e.preventDefault();
        });
        window.addEventListener('drop', (e) => {
            e.preventDefault();
        });

        function updateTabTheme() {
            const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const tabs = document.getElementsByClassName('tab');
            [...tabs].forEach(tab => {
                tab.classList.remove('tab-dark-mode', 'tab-light-mode');
                tab.classList.add(isDark ? 'tab-dark-mode' : 'tab-light-mode');
            });
        }

        // Initial theme set
        updateTabTheme();
        // Listen for theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateTabTheme);

        const token = await getDropboxAccessToken();

        const dbx = new Dropbox(token);
        const appLayout = new Layout(dbx);

    });
}