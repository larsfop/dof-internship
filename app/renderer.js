import { Tabs } from './tabs.js';
// import { Chatbox } from './chatbox.js';

// Chatbox and tabs logic for renderer process
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', async () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'node_modules/pdfjs-dist/build/pdf.worker.mjs'
        const tabs = new Tabs();
    });
}