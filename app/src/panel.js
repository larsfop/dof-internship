import * as eventHandlers from './event-handlers.js';
import { Tabs } from './tabs.js';

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
        this.panelContainer = document.createElement('div');
        this.panelContainer.className = 'panel-container';
        this.panelContainer.id = `panel-${this.id}`; // Unique ID for each panel

        if (fill) {
            // Create a container for the tabs
            this.tabContainer = document.createElement('div');
            this.tabContainer.className = 'tab-container';
            this.panelContainer.appendChild(this.tabContainer); // Append the tab container to the panel container

            const tabsList = document.createElement('div');
            tabsList.className = 'tabs-list';
            this.tabContainer.appendChild(tabsList); // Append the tabs list to the tab container

            const newTabBtn = document.createElement('button');
            newTabBtn.className = 'tab-new';
            newTabBtn.textContent = '+';
            newTabBtn.title = 'New Tab';
            newTabBtn.onclick = async (e) => {
                e.stopPropagation();
                const panelDiv = e.target.closest('.panel-container');
                const tab = this.addTab('chatbox', null);
                tab.appendContainer(panelDiv);
                tab.changeTab(); // Change to the newly created tab
            };
            this.tabContainer.appendChild(newTabBtn);

            // Create a container for the window content
            const windowContainer = document.createElement('div');
            windowContainer.className = 'window-container';
            this.panelContainer.appendChild(windowContainer); // Append the window container to the panel container

            const highlight = document.createElement('div');
            highlight.className = 'window-highlight';

            for (const sheet of document.styleSheets) {
                if (sheet.href && sheet.href.endsWith('styles.css')) {
                    for (const rule of sheet.cssRules) {
                        if (rule.selectorText && rule.selectorText.startsWith('.window-highlight.') && !rule.selectorText.endsWith('display')) {
                            const div = document.createElement('div');
                            div.className = rule.selectorText.replaceAll('.', ' ')
                            highlight.appendChild(div);
                        }
                    }
                }
            }

            windowContainer.appendChild(highlight); // Append the highlight to the window container
        }

        this.parentDiv.appendChild(this.panelContainer); // Append the panel container to the parent div

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