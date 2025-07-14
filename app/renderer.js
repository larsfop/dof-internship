import { Tabs } from './tabs.js';
import { Chatbox } from './chatbox.js';
import { Pdf } from './pdf.js';
import { Layout } from './layout.js';

// Chatbox and tabs logic for renderer process
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', async () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'node_modules/pdfjs-dist/build/pdf.worker.mjs'

        window.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
        window.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });


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