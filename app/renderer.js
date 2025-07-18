import { Chatbox } from './content.js';
import { Pdf } from './pdf.js';
import { Layout } from './layout.js';
import { Dropbox } from './dropbox.js';

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

        const appLayout = new Layout();
        const dbx = new Dropbox(token);

        // Download and display a PDF from Dropbox
        dbx.dbx.filesDownload({
            path: '/wip_lo/codes/ns-en-1995-1-1_2004+a2_2014+na_2024_en_001.pdf'
        }).then(response => {
            console.log(response.result);
            const blob = response.result.fileBlob;
            const url = URL.createObjectURL(blob);
            const tab = appLayout.addTab(appLayout.tabIdx++, 'pdf', url);
            const panelDiv = document.querySelector('.panel-container');

            const { panel1, panel2 } = appLayout.splitPanel('right', panelDiv);
            tab.appendContainer(panel2);

            const tabsList = panelDiv.querySelector('.tabs-list');
            const contents = panelDiv.querySelector('.window-container');

            panel1.appendChild(tabsList);
            panel1.appendChild(contents);
        });

        const worker = new Worker('./worker.js', { type: 'module' });
        console.log(worker)
        console.log(worker.methods)
        const readPDF = await worker.openDocument();

    });
}