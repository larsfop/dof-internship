import { Layout } from './layout.js';

function createUserID() {
    if (!localStorage.getItem('userID')) {
        const userID = crypto.randomUUID();
        localStorage.setItem('userID', 'test_user');
    }
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

        // Ensure a user ID is set for logging purposes
        createUserID();

        // Initial theme set
        updateTabTheme();
        // Listen for theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateTabTheme);

        const appLayout = new Layout();


    });
}