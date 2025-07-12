import { Tabs } from './tabs.js';
import { Chatbox } from './chatbox.js';
import { Pdf } from './pdf.js';
import { Layout } from './layout.js';

// Chatbox and tabs logic for renderer process
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', async () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'node_modules/pdfjs-dist/build/pdf.worker.mjs'

        window.addEventListener('dragover', (e) => e.preventDefault());
        window.addEventListener('drop', (e) => e.preventDefault());

        var config = {
            content: [
                {
                    type: 'row',
                    content: [
                        {
                            type: 'stack',
                            content: [
                                {
                                    type: 'component',
                                    componentName: 'chatbox',
                                    title: 'Chatbox',
                                },
                                {
                                    type: 'component',
                                    componentName: 'chatbox',
                                    title: 'Chatbox 2',
                                },
                            ]
                        },
                        {
                            type: 'component',
                            componentName: 'pdf',
                            title: 'PDF',
                        }
                    ]
                }
            ]
        }

        var layout = new GoldenLayout(config);

        layout.registerComponent('chatbox', function (container, state) {
            const chatbox = new Chatbox();
            const div = document.createElement('div');
            div.style.width = 'inherit';
            div.style.height = 'inherit';
            chatbox.appendContainer(div);
            container.getElement().append(div);
            chatbox.focusInput(); // Focus the input of the current tab
        });

        layout.registerComponent('pdf', function (container, state) {
            const pdf = new Pdf('../../../ns-en-1995-1-1_2004+a2_2014+na_2024_en_001.pdf');
            // pdf.appendContainer();
            container.getElement().append(pdf.mainContainer);
        });

        // layout.init();
        // const tabs = new Tabs();
        const appLayout = new Layout();
    });
}