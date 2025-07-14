import { Panel } from './panel.js';
import { Splitter } from './splitter.js';

let test = {
    layout: {
        type: 'row',
        content: 
        {
            p1: 'p1',
            splitter: 's1',
            p2: {
                type: 'column',
                content: 
                {
                    p1: 'p21',
                    splitter: 's2',
                    p2: 'p22'
                }
            
            }
        }
    
    }
}

let l = {
    s1: {
        type: 'row',
        p1: 'p1',
        splitter: 's1',
        p2: 'p2',
    },
    s2: {
        type: 'column',
        p1: 'p2',
        splitter: 's2',
        p2: 'p3'
    }
}

export class Layout {
    constructor() {
        this.panels = {};

        this.panelIdx = 0; // Index for the next panel to be added
        this.columns = 1; // Default to one column
        this.rows = 1; // Default to one row

        this.createUI();
        this.addPanel(); // Create tabs list if it doesn't exist
        this.addSplitter('vertical'); // Add a horizontal splitter
        this.addPanel(); // Initialize with one panel

        this.splitter.dragElement(); // Enable dragging between the two panels
        this.createListeners(); // Create event listeners for layout changes
    }

    createListeners() {
        // Add event listeners for layout changes, if needed
        document.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const target = e.target;
            const panelContainer = target.closest('.panel-container');
            const tgtPanel = this.panels[panelContainer.id];
            const tgtTab = tgtPanel.tabs[Number(target.id.split('')[1])];

            if (e.dataTransfer && e.dataTransfer.files.length > 0) {
                for (const file of e.dataTransfer.files) {
                    if (file.type === 'application/pdf') {
                        const filePath = window.file.getPath(file);
                        tgtPanel.addTab('pdf', filePath)
                    }
                }
            }

            if (target.classList.contains('tab')) {
                const srcPanel = this.panels[e.dataTransfer.getData('panelId')];
                const tabIdx = Number(e.dataTransfer.getData('tabId').split('')[1]);
                const srcTab = srcPanel.tabs[tabIdx];
                console.log(srcTab, tgtTab);
                if (srcPanel === tgtPanel) {
                    const parent = target.parentNode;
                    parent.insertBefore(srcTab.tabDiv, tgtTab.tabDiv); // Move the tab to the new position
                } else {
                    tgtPanel.moveTab(srcTab, tgtTab); // Move the tab to the new position
                    srcPanel.closeTab(tabIdx)
                }

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

    addPanel() {
        const panel = new Panel(this.panelIdx++); // Increment the index for the next panel
        panel.appendContainer(this.layoutContainer); // Append the panel to the layout container
        this.panels['p' + panel.panelIdx] = panel; // Store the panel in the panels object
    }

    addSplitter(direction) {
        this.splitter = new Splitter(direction);
        this.splitter.appendContainer(this.layoutContainer); // Append the splitter to the layout container

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

    splitPanel(panelIndex, direction) {
        if (panelIndex < 0 || panelIndex >= this.panels.length) {
            console.error('Invalid panel index');
            return;
        }

        const panel = this.panels[panelIndex];
        const newPanel = new Panel();
        newPanel.appendContainer(this.layoutContainer); // Append the new panel to the layout container

        // Logic to split the panel in the specified direction
        if (direction === 'horizontal') {
            // Implement horizontal split logic
        } else if (direction === 'vertical') {
            // Implement vertical split logic
        } else {
            console.error('Invalid split direction');
        }
    }

}