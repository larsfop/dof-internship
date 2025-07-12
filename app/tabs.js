import { Chatbox } from './chatbox.js';
import { Pdf } from './pdf.js';
// import { Window } from './window.js';

export class Tabs2 {
    constructor(idx, content) {
        this.idx = idx; // Store the index of the tab
        this.content = content; // Store the content of the tab

        this.createUI(); // Create UI elements for tabs and window
    }

    createUI() {
        // Create a container for the tabs
        this.tabDiv = document.createElement('div');
        this.tabDiv.id = 'tab'
        this.tabDiv.textContent = `Tab ${this.idx + 1}`;
        this.tabDiv.draggable = true;
    }

    appendContainer(tabContainer, contentContainer) {
        tabContainer.insertBefore(this.tabDiv, tabContainer.lastChild); // Insert before the last child to keep the new tab at the end
        contentContainer.appendChild(this.content.mainContainer); // Append the content's main container to the content container
    }

    toggleActive(force = null) {
        const active = this.tabDiv.classList.toggle('active', force); // Toggle the active class for the tab
        this.renderActive(active); // Render the active state of the tab
        if (active) {
            this.content.mainContainer.style.display = 'block'; // Show content when active
        } else {
            this.content.mainContainer.style.display = 'none'; // Hide content when inactive
        }
    }

    renderActive(active) {
        // Highlight current tab with adaptive color
        if (active) {
            this.tabDiv.style.background = window.matchMedia('(prefers-color-scheme: dark)').matches ? '#333' : '#e0e0e0';
            this.tabDiv.style.color = window.matchMedia('(prefers-color-scheme: dark)').matches ? '#fff' : '#222';
            this.tabDiv.style.fontWeight = 'bold';
            this.tabDiv.style.boxShadow = window.matchMedia('(prefers-color-scheme: dark)').matches ? '0 2px 8px #1118' : '0 2px 8px #ccc8';
        } else {
            this.tabDiv.style.background = window.matchMedia('(prefers-color-scheme: dark)').matches ? '#222' : '#fff';
            this.tabDiv.style.color = window.matchMedia('(prefers-color-scheme: dark)').matches ? '#bbb' : '#222';
            this.tabDiv.style.fontWeight = 'normal';
            this.tabDiv.style.boxShadow = 'none';
        }
    }

}  
    






export class Tabs {
    constructor() {
        // this.tabsList = document.getElementById('tabs-list');
        this.tabs = [];
        this.windows = [];
        this.currentTab = 0;

        this.addWindow(); // Create tabs list if it doesn't exist

        this.addTab(); // Initialize with one tab
        this.addTab(); // Initialize with one tab
        this.addTab('pdf', '../../../ns-en-1995-1-1_2004+a2_2014+na_2024_en_001.pdf'); // Add a PDF tab
        
        this.addListeners(); // Add event listeners for hotkeys
    }

    addListeners() {
        // Add listeners for hotkeys
        document.addEventListener('keydown', (e) => {
            this.hotkeys(e);
        });
    }

    createUI() {
        // Create a container for the tabs
        this.tabsList = document.createElement('div');
        this.tabsList.id = 'tabs-list';
        document.body.appendChild(this.tabsList); // Append to body or a specific container

        // Create a container for the window
        this.windowContainer = document.createElement('div');
        this.windowContainer.id = 'window-container';
    }

    addWindow() {
        this.createUI(); // Ensure UI is created
        const windowDiv = document.createElement('div');
        windowDiv.id = 'window';

        const windowSplitContainer = document.createElement('div');
        windowSplitContainer.id = 'window-split-container';
        windowSplitContainer.appendChild(this.windowContainer)
        windowSplitContainer.appendChild(this.tabsList);

        windowDiv.appendChild(windowSplitContainer);
        document.body.appendChild(windowDiv); // Append to body or a specific container
        this.windows.push(windowDiv);
    }

    addTab(type = 'chatbox', filePath = null) {
        let chatbox
        if (type == 'chatbox') {
            chatbox = new Chatbox();
        } else if (type == 'pdf') {
            chatbox = new Pdf(filePath)
        }

        const container = chatbox.mainContainer;
        container.style.display = 'none'
        this.windowContainer.appendChild(chatbox.mainContainer);
        this.tabs.push(chatbox);
        this.changeTab(this.tabs.length - 1); // Switch to the new tab
        this.renderTabs();
    }

    closeTab(index) {
        if (index >= this.tabs.length - 1) {
            if (index > 0) this.changeTab(this.currentTab - 1)
            else return
        } else {
            this.currentTab--; // Decrement current tab index
        }
        this.tabs.splice(index, 1);
        this.renderTabs();
    }

    renderTabs() {
        if (!this.tabsList) return;

        // Render chatbox UI for the current tab
        const chatBox = this.tabs[this.currentTab];
        if (chatBox) {
            chatBox.focusInput(); // Focus the input of the current tab        
        }


        // Render tabs list
        this.tabsList.innerHTML = '';
        this.tabs.forEach((tab, idx) => {
            const tabDiv = document.createElement('div');
            tabDiv.id = 'tab'
            tabDiv.className = 'tab' + (idx === this.currentTab ? ' active' : '');
            tabDiv.textContent = `Tab ${idx + 1}`;
            tabDiv.draggable = true;

            // Highlight current tab with adaptive color
            if (idx === this.currentTab) {
                tabDiv.style.background = window.matchMedia('(prefers-color-scheme: dark)').matches ? '#333' : '#e0e0e0';
                tabDiv.style.color = window.matchMedia('(prefers-color-scheme: dark)').matches ? '#fff' : '#222';
                tabDiv.style.fontWeight = 'bold';
                tabDiv.style.boxShadow = window.matchMedia('(prefers-color-scheme: dark)').matches ? '0 2px 8px #1118' : '0 2px 8px #ccc8';
            } else {
                tabDiv.style.background = window.matchMedia('(prefers-color-scheme: dark)').matches ? '#222' : '#fff';
                tabDiv.style.color = window.matchMedia('(prefers-color-scheme: dark)').matches ? '#bbb' : '#222';
                tabDiv.style.fontWeight = 'normal';
                tabDiv.style.boxShadow = 'none';
            }

            // Close button
            const closeBtn = document.createElement('button');
            closeBtn.id = 'tab-close'
            closeBtn.textContent = '×';
            closeBtn.title = 'Close Tab';
            closeBtn.onclick = (e) => {
                e.stopPropagation();
                this.closeTab(idx);
            };
            tabDiv.appendChild(closeBtn);

            tabDiv.onclick = () => {
                this.changeTab(idx); // Change to the clicked tab
                this.renderTabs();
            };

            // dragElement(tabDiv); // Make the tab draggable
            this.tabsList.appendChild(tabDiv);
        });

        const idx = this.tabs.length - 1;
        const newTabBtn = document.createElement('button');
        newTabBtn.id = 'tab-new';
        newTabBtn.textContent = '+';
        newTabBtn.title = 'New Tab';
        newTabBtn.onclick = (e) => {
            e.stopPropagation();
            this.addTab();
        };
        this.tabsList.appendChild(newTabBtn);
    }

    changeTab(idx) {
        const oldIdx = this.currentTab;
        this.tabs[oldIdx].mainContainer.style.display = 'none'; // Hide old tab
        this.tabs[idx].mainContainer.style.display = 'block'; // Show new tab
        this.currentTab = idx; // Update current tab index
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
            this.changeTab((this.currentTab + 1) % this.tabs.length); // Cycle through tabs
            this.renderTabs();
        }
    }
}