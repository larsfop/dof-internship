import { Chatbox } from './chatbox.js';
import { Pdf } from './pdf.js';
// import { Window } from './window.js';

export class Tabs {
    constructor(panelIdx, tabIdx, content) {
        this.panelIdx = panelIdx; // Store the index of the tab
        this.tabIdx = tabIdx; // Index for the next tab to be added
        this.content = content; // Store the content of the tab

        this.createUI(); // Create UI elements for tabs and window
        this.createListeners(); // Create event listeners for drag and drop
    }

    createListeners() {
        this.tabDiv.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('tabId', this.tabDiv.id); // Store the tab index in dataTransfer
            e.dataTransfer.setData('panelId', this.tabDiv.closest('.panel-container').id); // Store the panel ID in dataTransfer
            this.tabDiv.classList.add('dragging'); // Add a class to indicate
            const tabs = document.getElementsByClassName('tab');
            [...tabs].forEach((tab, index) => {
                tab.addEventListener('dragenter', (e) => {
                    e.preventDefault(); // Prevent default dragover behavior
                    // tab.style.backgroundColor = '#f0f0f0'; // Change background color on hover
                    const div = document.createElement('div');
                    div.className = 'tab-hover';
                    tab.appendChild(div); // Append a div to the tab to indicate hover
                });

                tab.addEventListener('dragleave', (e) => {
                    tab.style.backgroundColor = ''; // Reset background color on drag leave
                    tab.removeChild(tab.lastChild)
                });
            })
        })

        this.tabDiv.addEventListener('dragend', (e) => {
            this.tabDiv.classList.remove('dragging');
        })

        this.tabDiv.addEventListener('drop', (e) => {
            e.preventDefault(); // Prevent default drop behavior
            const div = document.getElementsByClassName('tab-hover');
            [...div].forEach((d) => {
                d.remove(); // Remove the hover indicator
            });
        })

    }

    createUI() {
        // Create a container for the tabs
        this.tabDiv = document.createElement('div');
        this.tabDiv.id = `t${this.tabIdx}`; // Unique ID for each tab
        this.tabDiv.className = 'tab'; // Add a class for styling if needed
        this.tabDiv.className += window.matchMedia('(prefers-color-scheme: dark)').matches ? ' tab-dark-mode' : ' tab-light-mode'; // Add class based on color scheme
        this.tabDiv.textContent = `Tab ${this.tabIdx + 1}`;
        this.tabDiv.draggable = true;
    }

    appendContainer(tabContainer, contentContainer) {
        tabContainer.insertBefore(this.tabDiv, tabContainer.lastChild); // Insert before the last child to keep the new tab at the end
        contentContainer.appendChild(this.content.mainContainer); // Append the content's main container to the content container
    }

    toggleActive(force = null) {
        const active = this.tabDiv.classList.toggle('active', force); // Toggle the active class for the tab
        // this.renderActive(active); // Render the active state of the tab
        if (active) {
            this.content.mainContainer.style.display = 'block'; // Show content when active
        } else {
            this.content.mainContainer.style.display = 'none'; // Hide content when inactive
        }
    }

    renderActive(active) {
        // Highlight current tab with adaptive color
        if (active) {
            this.tabDiv.
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
    
