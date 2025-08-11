import { chatSendHandler } from "./event-handlers.js";

export class Tabs {
    constructor(panelIdx, tabIdx, content, panel) {
        this.panelIdx = panelIdx; // Store the index of the tab
        this.tabIdx = tabIdx; // Index for the next tab to be added
        this.content = content; // Store the content of the tab
        this.panel = panel; // Store the panel reference

        this.createUI(); // Create UI elements for tabs and window
    }

    createUI() {
        // Create a container for the tabs
        this.tabDiv = document.createElement('div');
        this.tabDiv.id = `t${this.tabIdx}`; // Unique ID for each tab
        this.tabDiv.dataset.index = this.tabIdx; // Store the index of the tab in a data attribute
        this.tabDiv.className = 'tab'; // Add a class for styling if needed
        // this.tabDiv.textContent = `Tab ${this.tabIdx + 1}`;
        const div = document.createElement('div');
        div.className = 'tab-text';
        div.textContent = `Tab ${this.tabIdx + 1}`; // Set the tab text
        this.tabDiv.appendChild(div); // Append the text to the tab
        this.tabDiv.draggable = true;

        this.tabDiv.onclick = (e) => {
            e.stopPropagation(); // Prevent event bubbling
            this.changeTab(); // Change to the clicked tab
        };

        // Create a close button for the tab
        const closeButton = document.createElement('button');
        closeButton.className = 'tab-close';
        closeButton.textContent = '×'; // Close button symbol
        closeButton.onclick = (e) => {
            e.stopPropagation(); // Prevent event bubbling
            this.panel.removeTab(closeButton, this); // Remove the tab when the close button is clicked
        };

        try {
            this.content.chatSend.onclick = chatSendHandler.bind(this);
        } catch (error) {
            console.error(`${this.content} is not a chatbox`);
        }
        this.tabDiv.appendChild(closeButton); // Append the close button to the tab
    }

    appendContainer(panelDiv) {
        const containers = panelDiv.children; // Get the children of the panel container
        containers[0].insertBefore(this.tabDiv, containers[0].lastChild); // Insert before the last child to keep the new tab at the end
        containers[1].insertBefore(this.content.mainContainer, containers[1].lastChild); // Append the content's main container to the content container
    }

    changeTab() {
        const parent = this.tabDiv.parentNode; // Get the parent container of the tab
        const activeTab = parent.getElementsByClassName('active')[0]; // Get the

        if (activeTab) {
            if (activeTab !== this.tabDiv) {
                this.toggleActive(false, activeTab); // Deactivate the currently active tab
            }
        }
        this.toggleActive(true); // Activate the clicked tab
    }

    toggleActive(force = null, tabDiv = this.tabDiv) {
        const index = tabDiv.dataset.index;
        const content = document.querySelector(`.chat-container[data-index="${index}"], .pdf-viewer[data-index="${index}"]`);

        const active = tabDiv.classList.toggle('active', force); // Toggle the active class for the tab
        if (active) {
            content.style.display = 'block'; // Show content when active
        } else {
            content.style.display = 'none'; // Hide content when inactive
        }
    }


}  
    
