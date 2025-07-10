import { Chatbox } from './chatbox.js';

export class Tabs {
    constructor() {
        this.newTabButton = document.getElementById('new-tab-button');
        this.tabsList = document.getElementById('tabs-list');
        this.tabs = [];
        this.currentTab = 0;

        this.addTab(); // Initialize with one tab
        
        this.addListeners(); // Add event listeners for tab actions
    }

    addListeners() {
        // Add event listeners for new tab buttons
        this.newTabButton.addEventListener('click', () => {
            this.addTab();
            this.currentTab = this.getTabs().length - 1; // Update current tab index
            this.renderTabs();
        });

        document.addEventListener('keydown', (e) => {
            this.hotkeys(e);
        });
    }

    addTab() {
        const chatbox = new Chatbox();

        this.tabs.push(chatbox);
        this.currentTab = this.tabs.length - 1;
        this.renderTabs();
    }

    closeTab(index) {
        this.tabs.splice(index, 1);
        if (this.currentTab >= this.tabs.length) {
            this.currentTab = this.tabs.length - 1;
        }
        this.renderTabs();
    }

    renderTabs() {
        if (!this.tabsList) return;

        // Render chatbox UI for the current tab
        const chatBox = this.tabs[this.currentTab];
        if (chatBox) {
            chatBox.appendContainer();
            chatBox.focusInput(); // Focus the input of the current tab        
        }

        // Render tabs list
        this.tabsList.innerHTML = '';
        this.tabs.forEach((tab, idx) => {
            const tabDiv = document.createElement('div');
            tabDiv.className = 'tab' + (idx === this.currentTab ? ' active' : '');
            tabDiv.style.display = 'flex';
            tabDiv.style.alignItems = 'center';
            tabDiv.style.background = idx === this.currentTab ? '#e0e0e0' : '#fff';
            tabDiv.style.border = '1px solid #ccc';
            tabDiv.style.borderRadius = '4px';
            tabDiv.style.padding = '2px 8px';
            tabDiv.style.cursor = 'pointer';
            tabDiv.style.position = 'relative';
            tabDiv.textContent = `Tab ${idx + 1}`;

            // Close button
            const closeBtn = document.createElement('button');
            closeBtn.textContent = '×';
            closeBtn.title = 'Close Tab';
            closeBtn.style.marginLeft = '6px';
            closeBtn.style.background = 'transparent';
            closeBtn.style.border = 'none';
            closeBtn.style.cursor = 'pointer';
            closeBtn.style.fontSize = '16px';
            closeBtn.onclick = (e) => {
                e.stopPropagation();
                this.closeTab(idx);
            };
            tabDiv.appendChild(closeBtn);

            tabDiv.onclick = () => {
                this.currentTab = idx;
                this.renderTabs();
            };
            this.tabsList.appendChild(tabDiv);
        });
    }

    getTabs() {
        return this.tabs;
    }

    print() {
        console.log(this.tabs)
    }

    hotkeys(e) {
        // create new tab with Ctrl + T
        if (e.ctrlKey && e.key.toLowerCase() === 't') {
            e.preventDefault(); // Prevent default action
            this.addTab();
        }
        // close current tab with Ctrl + W
        if (e.ctrlKey && e.key.toLowerCase() === 'w') {
            e.preventDefault(); // Prevent default action
            this.closeTab(this.currentTab);
        }
        // switch to next tab with Ctrl + Tab
        if (e.ctrlKey && e.key.toLowerCase() === 'tab') {
            e.preventDefault(); // Prevent default action
            this.currentTab = (this.currentTab + 1) % this.tabs.length; // Cycle through tabs
            this.renderTabs();
        }
    }
}