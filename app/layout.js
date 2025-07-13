import { Panel } from './panel.js';
import { Splitter } from './splitter.js';

export class Layout {
    constructor() {
        this.panels = [];

        this.columns = 1; // Default to one column
        this.rows = 1; // Default to one row

        this.createUI();
        this.addPanel(1, 1); // Create tabs list if it doesn't exist
        this.addSplitter(0, 'vertical'); // Add a horizontal splitter
        this.addPanel(2, 1); // Initialize with one panel

        this.splitter.dragElement(this.panels[0].panelContainer, this.panels[1].panelContainer); // Enable dragging between the two panels
    }

    createUI() {
        // Create a container for the layout
        this.layoutContainer = document.createElement('div');
        this.layoutContainer.id = 'layout-container';
        this.layoutContainer.className = 'grid-container'; // Use grid layout for the main container
        document.body.appendChild(this.layoutContainer); // Append to body or a specific container
    }

    addPanel(column, row) {
        if (column > this.columns) this.columns = column; // Update columns if needed
        if (row > this.rows) this.rows = row; // Update rows if needed

        const panel = new Panel(column, row);
        panel.appendContainer(this.layoutContainer); // Append the panel to the layout container
        this.panels.push(panel); // Store the panel in the panels array
    }

    addSplitter(panelIndex, direction) {
        this.splitter = new Splitter(panelIndex, direction);
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