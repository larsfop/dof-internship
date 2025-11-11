import * as eventHandlers from './event-handlers.js';
import { Tabs } from './tabs.js';
import { newHTMLElement, setLastActive } from './utils/html-helper-functions.js';

export class Panel {
    constructor(parentDiv, history = null, fill = true) {
        this.id = crypto.randomUUID();
        this.tabIdx = 0;
        this.parentDiv = parentDiv;

        this.createUI(fill);
        this.createListeners();
    }

    createListeners() {
        // Add event listeners for window highlights
        document.addEventListener('dragenter', eventHandlers.dragEnterHandler);
        document.addEventListener('dragend', eventHandlers.dragEndHandler);
    }

    createUI(fill = true) {
        // Create a container for the panels
        this.panelContainer = newHTMLElement('div', this.parentDiv, {
            className: 'panel-container',
            id: `panel-${this.id}`
        });
        setLastActive(this.panelContainer);

        if (fill) {
            // Create a container for the tabs
            this.tabContainer = newHTMLElement('div', this.panelContainer, {
                className: 'tab-container'
            });

            const tabsList = newHTMLElement('div', this.tabContainer, {
                className: 'tabs-list'
            });
            tabsList.addEventListener('wheel', (e) => {
                if (e.deltaY !== 0) {
                    e.preventDefault();
                    tabsList.scrollLeft += e.deltaY;
                }
            });
            const newTabBtn = newHTMLElement('button', this.tabContainer, {
                className: 'tab-new',
                textContent: '+',
                title: 'New Tab'
            });
            newTabBtn.onclick = (e) => {
                const panelDiv = e.target.closest('.panel-container');
                const tab = this.addTab('chatbox', null);
                tab.appendContainer(panelDiv);
                tab.changeTab(); // Change to the newly created tab
            };

            // Create a container for the window content
            const windowContainer = newHTMLElement('div', this.panelContainer, {
                className: 'window-container'
            });

            const highlight = newHTMLElement('div', windowContainer, {
                className: 'window-highlight'
            });

            for (const sheet of document.styleSheets) {
                if (sheet.href && sheet.href.endsWith('styles.css')) {
                    for (const rule of sheet.cssRules) {
                        if (rule.selectorText && rule.selectorText.startsWith('.window-highlight.') && !rule.selectorText.endsWith('display')) {
                            const div = newHTMLElement('div', highlight, {
                                className: rule.selectorText.replaceAll('.', ' ')
                            });
                        }
                    }
                }
            }

        }
    }

    addTab(type = 'chatbox', data = null) {
        const tab = new Tabs();
        tab.setupContent(type, data);

        console.log(this.panelContainer);
        tab.appendContainer(this.panelContainer); // Append the content container to the window container
        tab.changeTab(); // Change to the newly created tab

        return tab;
    }
}