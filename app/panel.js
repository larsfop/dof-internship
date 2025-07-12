import { Tabs2 } from './tabs.js';
import { Chatbox } from './chatbox.js';
import { Pdf } from './pdf.js';

export class Panel {
    constructor(column, row) {
        this.column = column;
        this.row = row;

        this.createUI();
        this.tabs = [];
        this.currentWindow = null;
        this.currentTab = 0;

        this.active = true;
        this.addTab(); // Initialize with one tab
        this.addTab('pdf', '../../../ns-en-1995-1-1_2004+a2_2014+na_2024_en_001.pdf'); // Add a PDF tab
    
        this.createListeners(); // Create event listeners for hotkeys
    }

    createListeners() {
        // Add listener for file drop events
        this.panelContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            if (e.dataTransfer && e.dataTransfer.files.length > 0) {
                for (const file of e.dataTransfer.files) {
                    if (file.type === 'application/pdf') {
                        const filePath = window.file.getPath(file);
                        this.addTab('pdf', filePath)
                    }
                }
            }
        })
    }

    createUI() {
        // Create a container for the window
        this.panelContainer = document.createElement('div');
        this.panelContainer.id = 'panel-container';
        this.panelContainer.style.gridColumn = this.column;
        this.panelContainer.style.gridRow = this.row;

        // Create a container for the tabs
        this.tabsList = document.createElement('div');
        this.tabsList.id = 'tabs-list';
        this.panelContainer.appendChild(this.tabsList); // Append the tabs list to the panel container

        this.newTabBtn = document.createElement('button');
        this.newTabBtn.id = 'tab-new';
        this.newTabBtn.textContent = '+';
        this.newTabBtn.title = 'New Tab';
        this.newTabBtn.onclick = (e) => {
            e.stopPropagation();
            this.addTab();
        };
        this.tabsList.appendChild(this.newTabBtn);

        // Create a container for the window content
        this.windowContainer = document.createElement('div');
        this.windowContainer.id = 'window-container';
        this.panelContainer.appendChild(this.windowContainer); // Append the window container to the panel container
    }

    appendContainer(container) {
        container.appendChild(this.panelContainer);
    }

    addTab(type = 'chatbox', file = null) {
        const idx = this.tabs.length; // Get the current index for the new tab

        // Fill window content
        let content;
        if (type === 'chatbox') {
            content = new Chatbox();

        } else if (type === 'pdf' && file) {
            content = new Pdf(file);
        }

        const tab = new Tabs2(idx, content);
        tab.appendContainer(this.tabsList, this.windowContainer); // Append the tab's UI to the panel container
        tab.tabDiv.onclick = () => {
            this.changeTab(idx); // Change to the clicked tab
        };

        this.tabs.push(tab);
        this.changeTab(idx); // Change to the newly added tab
        this.currentTab = idx; // Set the current tab to the newly added tab
    }

    changeTab(idx) {
        const oldIdx = this.currentTab;
        if (oldIdx === idx) return; // No change if the same tab is clicked
        this.tabs[oldIdx].toggleActive(false); // Deactivate the old tab
        this.tabs[idx].toggleActive(true); // Activate the new tab
        this.currentTab = idx; // Update the current tab index
    }
}
