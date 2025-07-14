import { Tabs } from './tabs.js';
import { Chatbox } from './chatbox.js';
import { Pdf } from './pdf.js';

export class Panel {
    constructor(idx) {
        this.tabs = [];
        this.currentWindow = null;
        this.currentTab = 0;
        this.panelIdx = idx; // Store the index of the panel
        this.tabIdx = 0; // Index for the next tab to be added

        this.active = true;
        this.createUI();
        this.addTab(); // Initialize with one tab
        this.tabs[0].toggleActive(true); // Set the first tab as active
    
        this.createListeners(); // Create event listeners for hotkeys
    }

    createListeners() {
        // this.tabsList.addEventListener('drop', (e) => {
        //     e.preventDefault();
        //     const data = e.dataTransfer.getData('id');
        //     const src = document.getElementById(data);
        //     const target = e.target
        //     if (target.classList.contains('tab')) {
        //         const parent = target.parentNode;
        //         parent.insertBefore(src, target); // Move the tab to the new position
        //     };
// 
        //     console.log(target, src);
        // });

        window.addEventListener('keydown', (e) => {
            this.hotkeys(e);
        });
    }

    createUI() {
        // Create a container for the window
        this.panelContainer = document.createElement('div');
        this.panelContainer.className = 'panel-container';
        this.panelContainer.id = `p${this.panelIdx}`; // Unique ID for each panel

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

        const tab = new Tabs(this.panelIdx, idx, content);
        tab.appendContainer(this.tabsList, this.windowContainer); // Append the tab's UI to the panel container
        tab.tabDiv.onclick = () => {
            this.changeTab(idx); // Change to the clicked tab
        };

        this.tabs.push(tab); // Store the tab in the tabs object
        if (this.tabs.length === 1) {
            tab.toggleActive(true); // Activate the first tab
        } else {
            this.changeTab(idx); // Change to the newly added tab
        }
        this.currentTab = idx; // Set the current tab to the newly added tab
    }

    moveTab(srcTab, tgtTab) {
        // Move a tab from a different panel to this panel before the specified index
        const div = srcTab.tabDiv;
        const idx = this.tabs.length; // Get the current index for the moved tab
        div.id = `t${idx}`; // Update the ID for the moved tab
        div.textContent = `Tab ${idx + 1}`; // Update the tab text
        div.onclick = () => {
            this.changeTab(idx); // Change to the moved tab
        }

        // Add tab content to the window container
        this.windowContainer.appendChild(srcTab.content.mainContainer);
        this.tabsList.insertBefore(srcTab.tabDiv, tgtTab.tabDiv); // Move the tab to the new position
        this.tabs.push(srcTab); // Add the tab to this panel's tabs

        this.changeTab(this.tabs.length - 1); // Change to the newly moved tab
    }

    closeTab(idx, moved=false) {
        if (idx === this.currentTab) {
            if (idx === 0) this.tabs[1].toggleActive(true); // Activate the next tab if closing the first tab
            else this.tabs[idx - 1].toggleActive(true); // Activate the previous tab if closing a non-first tab
        }
        if (this.currentTab != 0) this.currentTab--; // Decrement current tab if unless it's the first tab
        this.tabs.splice(idx, 1); // Remove the tab from the tabs array

        for (let i = idx; i < this.tabs.length; i++) {
            this.tabs[i].tabId--; // Decrement the tabId for remaining tabs
            this.tabs[i].tabDiv.id = `t${i}`; // Update the tabDiv ID
            this.tabs[i].tabDiv.textContent = `Tab ${i + 1}`; // Update the tab text
            this.tabs[i].tabDiv.onclick = () => {
                this.changeTab(i); // Change to the clicked tab
            };
        }
    }

    changeTab(idx) {
        const oldIdx = this.currentTab;
        console.log('Changing tab from', oldIdx, 'to', idx);
        if (oldIdx === idx) return; // No change if the same tab is clicked
        this.tabs[oldIdx].toggleActive(false); // Deactivate the old tab
        this.tabs[idx].toggleActive(true); // Activate the new tab
        this.currentTab = idx; // Update the current tab index
    }

    hotkeys(e) {
        if (e.key === 'Escape') {
            this.focusInput(); // Focus the input field on Escape key
        } else if (e.key === 't' && e.ctrlKey) {
            this.addTab(); // Add a new tab on Ctrl + t
        } else if (e.key === 'Tab' && e.shiftKey) {
            e.preventDefault(); // Prevent default tab behavior
            const nextTab = (this.currentTab + 1) % this.tabs.length; // Cycle through tabs
            this.changeTab(nextTab);
        } else if (e.key === 'w' && e.ctrlKey) {
            if (this.tabs.length > 1) {
                this.closeTab(this.currentTab); // Close the current tab on Ctrl + w
            }
        }
    }

}
