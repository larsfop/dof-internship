import { Splitter } from './splitter.js';
import { Tabs } from './tabs.js';
import { Chatbox, Pdf } from './content.js';
import * as eventHandlers from './event-handlers.js';
import { HistoryMenu } from './history/history.js';

export class Layout {
    constructor() {
        this.panels = {};
        this.documents = {};

        this.panelIdx = 0; // Index for the next panel to be added
        this.columns = 1; // Default to one column
        this.rows = 1; // Default to one row

        this.tabIdx = 0; // Index for the next tab to be added

        this.history = new HistoryMenu(this);

        this.createUI();
        this.addPanel(); // Create tabs list if it doesn't exist

        this.history.createUI(this.sidebarDiv);
        this.history.loadHistory();

        this.dragEntered = true;
        this.createListeners(); // Create event listeners for layout changes
    }

    createListeners() {

        // Add event listeners for window highlights
        document.addEventListener('dragenter', eventHandlers.dragEnterHandler);
        document.addEventListener('dragend', eventHandlers.dragEndHandler);

        // Add event listener for file dropping
        document.addEventListener('drop', this.dropFile.bind(this));

    }

    createUI() {
        this.sidebarDiv = document.createElement('div');
        this.sidebarDiv.id = 'sidebar';
        this.sidebarDiv.className = 'sidebar';
        document.body.appendChild(this.sidebarDiv);

        // Add button to expand menu
        this.expandButton = document.createElement('button');
        this.expandButton.id = 'sidebar-expand-button';
        this.expandButton.className = 'sidebar-button';
        this.expandButton.textContent = '☰';
        this.sidebarDiv.appendChild(this.expandButton);

        this.expandButton.onclick = () => {
            this.sidebarDiv.classList.toggle('expanded');
            this.expandButton.classList.toggle('expanded');
            this.history.toggleExpand();
        };

        // Create a container for the layout
        this.layoutContainer = document.createElement('div');
        this.layoutContainer.id = 'layout-container';
        this.layoutContainer.className = 'layout-container'; // Use grid layout for the main container
        document.body.appendChild(this.layoutContainer); // Append to body or a specific container
    }

    createPanelUI(fill = true) {
        // Create a container for the panels
        const panelContainer = document.createElement('div');
        panelContainer.className = 'panel-container';
        panelContainer.id = `p${this.panelIdx++}`; // Unique ID for each panel

        if (fill) {
            // Create a container for the tabs
            const tabsList = document.createElement('div');
            tabsList.className = 'tabs-list';
            panelContainer.appendChild(tabsList); // Append the tabs list to the panel container

            const newTabBtn = document.createElement('button');
            newTabBtn.className = 'tab-new';
            newTabBtn.textContent = '+';
            newTabBtn.title = 'New Tab';
            newTabBtn.onclick = async (e) => {
                e.stopPropagation();
                const panelDiv = e.target.closest('.panel-container');
                const tab = this.addTab(this.tabIdx++);
                tab.appendContainer(panelDiv);
                tab.changeTab(); // Change to the newly created tab
            };
            tabsList.appendChild(newTabBtn);
            tabsList.addEventListener('dragstart', eventHandlers.tabListEventHandler.bind(this));

            // Create a container for the window content
            const windowContainer = document.createElement('div');
            windowContainer.className = 'window-container';
            panelContainer.appendChild(windowContainer); // Append the window container to the panel container

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


        return panelContainer;
    }

    async addPanel() {
        const panelContainer = this.createPanelUI(); // Create the UI for the panel
        this.layoutContainer.appendChild(panelContainer); // Append the panel container to the layout container
        for (let i = 0; i < 1; i++) {
            const tab = this.addTab(this.tabIdx++); // Initialize with one tab
            tab.appendContainer(panelContainer);
            tab.changeTab(); // Change to the newly created tab
        }
    }

    async chatSendHandler(content) {
        const msg = content.chatInput.value.trim();
        content.input(msg);

        this.history.addEntry(content.sessionID);
    }

    addTab(tabIdx, type = 'chatbox', file = null, sessionID = null, data = null) {
        // Fill window content
        let content;
        if (type === 'chatbox') {
            content = new Chatbox(tabIdx, this, sessionID, data);

            // Setup chat send handler
            content.chatSend.onclick = this.chatSendHandler.bind(this, content);
        } else if (type === 'pdf' && file) {
            content = new Pdf(file, tabIdx, sessionID);
        }

        const tab = new Tabs(this.panelIdx, tabIdx, content, this);

        return tab
    }

    removeTab(button, tab) {
        // Logic to remove a tab
        // This should handle removing the tab from the UI and updating the layout accordingly
        const tabDiv = button.parentNode; // Get the parent tab div
        const panel = tabDiv.closest('.panel-container'); // Get the closest panel container

        // Get tab index in the tab list
        const remainingTabs = panel.getElementsByClassName('tab');
        const index = Array.from(remainingTabs).indexOf(tabDiv);

        tabDiv.remove(); // Remove the tab from the panel
        tab.content.mainContainer.remove(); // Remove the content from the panel

        // Change tab if the removed tab was active
        console.log(index, remainingTabs.length);
        if (tabDiv.classList.contains('active') && remainingTabs.length > 0)
            tab.toggleActive(true, remainingTabs[index - 1]); // Activate the first remaining tab

        // If no tabs left, remove the panel
        if (remainingTabs.length === 0) {
            this.removePanel(panel);
        }
    }

    addSplitter(direction, container = this.layoutContainer) {
        this.splitter = new Splitter(direction);
        this.splitter.appendContainer(container); // Append the splitter to the layout container
        
        // Set panel widths
        const elements = container.getElementsByClassName('panel-container');
        const elm1 = elements[0];
        const elm2 = elements[1];
    }

    splitPanel(direction, panel) {
        const panel1 = this.createPanelUI(false); // Create a new panel UI
        const panel2 = this.createPanelUI(true); // Create another new panel UI
        if (direction === 'right' || direction === 'left') {
            panel1.style.marginRight = '-8px';
            panel1.style.borderRight = '4px solid gray'; // Add a border to the right side
            // Split the panel horizontally
            if (direction === 'right') {
            panel.classList.add('split-row'); // Add a class for styling            if (direction === 'right') {
                panel.appendChild(panel1); // Move the current panel to the new panel
                this.addSplitter('vertical', panel); // Add a vertical splitter
                panel.appendChild(panel2); // Append the new panel UI
            } else if (direction === 'left') {
                panel.appendChild(panel2); // Move the current panel to the new panel
                this.addSplitter('vertical', panel); // Add a vertical splitter
                panel.appendChild(panel1); // Append the new panel UI
            }

            this.splitter.dragElement(); // Enable dragging between the two panels

            return { panel1, panel2 };
        } else if (direction === 'bottom' || direction === 'top') {
            panel1.style.marginBottom = '-8px';
            panel1.style.borderBottom = '4px solid gray'; // Add a border to the bottom side
            // Split the panel vertically
            panel.classList.add('split-column'); // Add a class for styling
            if (direction === 'bottom') {
                panel.appendChild(panel1); // Move the current panel to the new panel
                this.addSplitter('horizontal', panel); // Add a horizontal splitter
                panel.appendChild(panel2); // Append the new panel UI
            } else if (direction === 'top') {
                panel.appendChild(panel2); // Move the current panel to the new panel
                this.addSplitter('horizontal', panel); // Add a horizontal splitter
                panel.appendChild(panel1); // Append the new panel UI
            }

            this.splitter.dragElement(); // Enable dragging between the two panels

            return { panel1, panel2 };
        } else {
            throw new Error('Invalid direction for splitting panel');
        }
    }

    // Merge two panels into one when closing the last tab
    removePanel(panel) {
        const parent = panel.parentNode; // Get the parent container of the panel
        if (parent.classList.contains('layout-container')) {
            // If the panel is the only one in the layout, remove it
            parent.removeChild(panel);
        }
        else if (parent.classList.contains('split-row') || parent.classList.contains('split-column')) {
            // Remove splitter
            if (parent.firstChild === panel) {
                parent.removeChild(panel.nextSibling);
            } else {
                parent.removeChild(panel.previousSibling);
            }

            panel.remove(); // Remove the panel
        }

        if (parent.getElementsByClassName('panel-container').length === 1) {
            // If one panel remains, move the panel up one level
            const child = parent.firstChild; // Get the first child of the parent
            const parentParent = parent.parentNode; // Get the parent of the parent
            child.style.margin = '0'; // Reset margin
            child.style.border = 'none'; // Reset border
            child.style.width = '100%'; // Reset width to full
            child.style.height = '100%'; // Reset height to full

            if (parentParent.firstChild === parent) {
                parentParent.insertBefore(child, parent); // Insert the child before the parent
                if (parentParent.classList.contains('split-row')) {
                    child.style.marginRight = '-8px'; // Adjust margin for row split
                    child.style.borderRight = '4px solid gray'; // Add a border to the right side
                } else if (parentParent.classList.contains('split-column')) {
                    child.style.marginBottom = '-8px'; // Adjust margin for column split
                    child.style.borderBottom = '4px solid gray'; // Add a border to the bottom side
                }
            } else {
                parent.parentNode.appendChild(child);   
            }

            parent.remove(); // Remove the empty parent container
        }
    }


    async dropFile(e) {
        e.preventDefault();
        e.stopPropagation();

        for (const file of e.dataTransfer.files) {
            if (file.type === 'application/pdf') {
                const filePath = window.file.getPath(file);
                const tab = this.addTab(this.tabIdx++, 'pdf', filePath);
                e.target.classList.remove('highlight-display'); // Remove the class indicating the dragenter event
                if (e.target.classList.contains('window-highlight') && !e.target.classList.contains('highlight-center')) {
                    const direction = e.target.classList[1].split('-')[1]; // Get the direction from the class name
                    const panelDiv = e.target.closest('.panel-container');


                    const { panel1, panel2 } = this.splitPanel(direction, panelDiv); // Split the panel in the specified direction
                    console.log(panel1, panel2);
                    
                    tab.appendContainer(panel2); // Append the first panel to the new tab

                    const tabsList = panelDiv.querySelector('.tabs-list');
                    const contents = panelDiv.querySelector('.window-container');
                    panel1.appendChild(tabsList); // Append the tabs list to the first panel
                    panel1.appendChild(contents); // Append the contents to the first panel

                } else {
                    const panel = e.target.closest('.panel-container');
                    tab.appendContainer(panel);
                }
                tab.changeTab(); // Change to the newly created tab
            }
        }

        // Call the drag end handler manually
        eventHandlers.dragEndHandler(e);
    }


}