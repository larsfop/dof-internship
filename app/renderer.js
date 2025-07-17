import { Chatbox } from './content.js';
import { Pdf } from './pdf.js';
import { Layout } from './layout.js';
import { Dropbox } from './dropbox.js';




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

        const dbx = new Dropbox();

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
                                {
                                    type: 'component',
                                    componentName: 'chatbox',
                                    title: 'Chatbox 2',
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
                            componentName: 'chatbox',
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

        // Download and display a PDF from Dropbox
        dbx.dbx.filesDownload({
            path: '/wip_lo/codes/ns-en-1995-1-1_2004+a2_2014+na_2024_en_001.pdf'
        }).then(response => {
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


        const splitters = document.getElementsByClassName('lm_splitter');
        [...splitters].forEach((splitter) => {
            const parent = splitter.parentElement;
            layout.root.getItemsByType('component').forEach(item => {
                console.log(item.container.width);
                console.log(item.container);
            });

            splitter.addEventListener('mousedown', (e) => {
                console.log('Mouse down');
                const pdfs = document.getElementsByClassName('pdf-viewer');
                const elements = splitter.parentElement.getElementsByClassName('lm_item');
                var md = {
                    e,
                    offsetLeft: splitter.offsetLeft,
                    offsetTop: splitter.offsetTop,
                    elm1Width: elements[0].offsetWidth,
                    elm2Width: elements[1].offsetWidth,
                };
                
                [...pdfs].forEach((pdf) => {
                    pdf.style.pointerEvents = 'none'; // Disable pointer events on PDF viewer during drag
                });

                function onMouseMove(e) {
                    console.log('Mouse move');
                    var delta = {
                        x: e.clientX - md.e.clientX,
                        y: e.clientY - md.e.clientY,
                    }
                    delta.x = Math.min(Math.max(delta.x, -md.elm1Width), md.elm2Width);
                    elements[0].style.width = `${md.elm1Width + delta.x}px`;
                    elements[0].lastChild.style.width = `${md.elm1Width + delta.x}px`;
                    elements[0].lastChild.lastChild.style.width = `${md.elm1Width + delta.x}px`;
                    elements[0].lastChild.lastChild.lastChild.style.width = `${md.elm1Width + delta.x}px`;


                    elements[1].style.width = `${md.elm2Width - delta.x}px`;
                    elements[1].lastChild.style.width = `${md.elm2Width - delta.x}px`;
                    elements[1].lastChild.lastChild.style.width = `${md.elm2Width - delta.x}px`;
                    elements[1].lastChild.lastChild.lastChild.style.width = `${md.elm2Width - delta.x}px`;

                    splitter.style.left = `0px`;
                }

                function onMouseUp() {
                    console.log('Mouse up');
                    const pdfs = document.getElementsByClassName('pdf-viewer');
                    [...pdfs].forEach((pdf) => {
                        pdf.style.pointerEvents = 'auto'; // Re-enable pointer events on PDF viewer after drag
                    });

                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                }

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        });
    });
}