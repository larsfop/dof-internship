import { Splitter } from './splitter.js';
import { Tabs } from './tabs.js';
import { Chatbox, Pdf } from './content.js';

export class Layout {
    constructor() {
        this.panels = {};

        this.panelIdx = 0; // Index for the next panel to be added
        this.columns = 1; // Default to one column
        this.rows = 1; // Default to one row

        this.tabIdx = 0; // Index for the next tab to be added

        this.createUI();
        this.addPanel(); // Create tabs list if it doesn't exist

        this.createListeners(); // Create event listeners for layout changes
    }

    createListeners() {
        // Add event listeners for layout changes, if needed
        const self = this;
        let dragEntered = true
        document.addEventListener('dragenter', (e) => {
            e.preventDefault();
            e.stopPropagation();

            function handleDragenter(e) {
                e.preventDefault(); // Prevent default dragover behavior
                
                e.target.classList.add('highlight-display'); // Add a class to indicate the dragenter event
            }

            function handleDragleave(e) {
                e.preventDefault(); // Prevent default dragleave behavior

                e.target.classList.remove('highlight-display'); // Remove the class indicating the dragenter event
            }

            function handleDrop(e) {
                e.preventDefault(); // Prevent default drop behavior
                e.stopPropagation();

                if (e.dataTransfer.files.length === 0) return; // No files to process


                for (const file of e.dataTransfer.files) {
                    if (file.type === 'application/pdf') {
                        const filePath = window.file.getPath(file);
                        const tab = self.addTab(self.tabIdx++, 'pdf', filePath);
                        e.target.classList.remove('highlight-display'); // Remove the class indicating the dragenter event
                        if (e.target.classList.contains('window-highlight') && !e.target.classList.contains('highlight-center')) {
                            const direction = e.target.classList[1].split('-')[1]; // Get the direction from the class name
                            const panelDiv = e.target.closest('.panel-container');


                            const { panel1, panel2 } = self.splitPanel(direction, panelDiv); // Split the panel in the specified direction
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

                document.removeEventListener('drop', handleDrop);
                const windowsHighlights = document.getElementsByClassName('window-highlight');
                [...windowsHighlights].forEach((windowsHighlight) => {
                    windowsHighlight.style.pointerEvents = 'none'; // Disable pointer events on window highlights
                    [...windowsHighlight.children].forEach((div) => {
                        div.removeEventListener('dragenter', handleDragenter);
                        div.removeEventListener('dragleave', handleDragleave); // Remove drag leave event listener
                    })
                });
                dragEntered = true; // Prevent multiple dragenter events
            }

            if (dragEntered) {
                document.addEventListener('drop', handleDrop);
                const windowsHighlights = document.getElementsByClassName('window-highlight');
                [...windowsHighlights].forEach((windowsHighlight) => {
                    windowsHighlight.style.pointerEvents = 'auto'; // Enable pointer events on window highlights
                    [...windowsHighlight.children].forEach((div) => {
                        div.addEventListener('dragenter', handleDragenter);
                        div.addEventListener('dragleave', handleDragleave); // Handle drag leave on window containers
                    })
                })  
                dragEntered = false; // Prevent multiple dragenter events
            }
    
        });
    }

    createUI() {
        // Create a container for the layout
        this.layoutContainer = document.createElement('div');
        this.layoutContainer.id = 'layout-container';
        this.layoutContainer.className = 'horisontal-container'; // Use grid layout for the main container
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
            newTabBtn.onclick = (e) => {
                e.stopPropagation();
                const panelDiv = e.target.closest('.panel-container');
                const tab = this.addTab(this.tabIdx++);
                tab.appendContainer(panelDiv);
                tab.changeTab(); // Change to the newly created tab
            };
            tabsList.appendChild(newTabBtn);

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

    addPanel() {
        const panelContainer = this.createPanelUI(); // Create the UI for the panel
        this.layoutContainer.appendChild(panelContainer); // Append the panel container to the layout container
        const tab = this.addTab(this.tabIdx++); // Initialize with one tab
        tab.appendContainer(panelContainer);
        tab.changeTab(); // Change to the newly created tab
    }

    addTab(tabIdx, type = 'chatbox', file = null) {
        // Fill window content
        let content;
        if (type === 'chatbox') {
            content = new Chatbox();
        } else if (type === 'pdf' && file) {
            content = new Pdf(file);
        }
        content.mainContainer.id = `c${this.tabIdx}`; // Set a unique ID for the content container

        const tab = new Tabs(this.panelIdx, tabIdx, content, this);

        return tab
    }

    addSplitter(direction, container = this.layoutContainer) {
        this.splitter = new Splitter(direction);
        this.splitter.appendContainer(container); // Append the splitter to the layout container

        /*
        const splitter = document.createElement('div');
        splitter.id = 'splitter'
        if (direction === 'horizontal') splitter.className = 'splitter-horizontal';
        else if (direction === 'vertical') splitter.className = 'splitter-vertical';
        else throw new Error('Invalid splitter direction');

        splitter.style.left = `${this.layoutContainer.clientWidth/2 + 4}px`;

        this.layoutContainer.appendChild(splitter); // Append the splitter to the layout container
        */
    }

    splitPanel(direction, panel) {
        if (direction === 'right' || direction === 'left') {
            // Split the panel horizontally
            panel.classList.add('split-row'); // Add a class for styling
            const panelChildren = panel.children;

            const panel1 = this.createPanelUI(false); // Create a new panel UI
            const panel2 = this.createPanelUI(true); // Create another new panel UI
            if (direction === 'right') {
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
            // Split the panel vertically
            panel.classList.add('split-column'); // Add a class for styling
            const panelChildren = panel.children;

            const panel1 = this.createPanelUI(false); // Create a new panel UI
            const panel2 = this.createPanelUI(true); // Create another new panel UI
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

}