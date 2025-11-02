import { Panel } from '../panel.js';
import { Splitter } from '../splitter.js';

/**
 * Create a new HTML element with optional attributes and styles.
 * @param {string} tag - The HTML tag to create.
 * @param {HTMLElement} [parent=null] - The parent element to append the new element to.
 * @param {Object} [attributes] - The attributes to set on the element.
 * @param {Object} [styles] - The styles to apply to the element.
 * @returns {HTMLElement} The newly created HTML element.
 */
export function newHTMLElement(tag, parent = null, attributes, styles) {
    const element = document.createElement(tag);
    if (attributes) {
        for (const [key, value] of Object.entries(attributes)) {
            element[key] = value;
        }
    }
    if (styles) {
        for (const [key, value] of Object.entries(styles)) {
            element.style[key] = value;
        }
    }
    if (parent) {
        parent.appendChild(element);
    }
    return element;
}


/** * Toggle the 'hidden' class on an HTML element and manage its inert attribute.
 * @param {HTMLElement} element - The HTML element to toggle.
 * @param {boolean|null} [force=null] - If true, add 'hidden'; if false, remove 'hidden'; if null, toggle.
 */
export function toggleHidden(element, force = null) {
    const isHidden = element.classList.toggle('hidden', force);
    if (isHidden) {
        element.setAttribute('inert', '');
    } else {
        element.removeAttribute('inert');
    }
}


export function scrollInputHandler(e,) {
    e.preventDefault();
    const step = Number(this.step) || 1;
    const min = this.min !== '' ? Number(this.min) : -Infinity;
    const max = this.max !== '' ? Number(this.max) : Infinity;
    let value = Number(this.value) || 0;

    if (e.deltaY < 0) {
        // Scroll up: increase value
        value = Math.min(value + step, max);
    } else {
        // Scroll down: decrease value
        value = Math.max(value - step, min);
    }
    this.value = value;
    return value;
}


export function splitPanel(panelDiv, direction) {
    const panel1 = new Panel(panelDiv, null, false); // Create new empty panel
    const panel2 = new Panel(panelDiv, null, true); // Create new filled panel

    const panel1Div = panel1.panelContainer;
    const panel2Div = panel2.panelContainer;

    let splitter;
    const split = window.Split({
        minSize: 240,
        snapOffset: 0,
        onDragStart: function(direction, track) {
            console.log(this)
            this.element.classList.add('dragging');
        },
        onDragEnd: function(direction, track) {
            this.element.classList.remove('dragging');
        }
    })
    if (direction === 'right' || direction === 'left') {
        panelDiv.classList.add('split-row'); // Add a class for styling
        // Split the panel horizontally
        if (direction === 'right') {
            panelDiv.appendChild(panel1Div); // Move the current panel to the new panel
            // splitter = new Splitter('vertical', panelDiv);
            panelDiv.appendChild(panel2Div); // Append the new panel UI
        } else if (direction === 'left') {
            panelDiv.appendChild(panel2Div); // Move the current panel to the new panel
            // splitter = new Splitter('vertical', panelDiv);
            panelDiv.appendChild(panel1Div); // Append the new panel UI
        }

        const gutter = newHTMLElement('div', null, 
            { className: 'gutter gutter-col' },
            { 'grid-column': '2' }
        )
        panelDiv.insertBefore(gutter, panelDiv.lastChild);
        split.addColumnGutter(gutter, 1);
        console.log(split);
        // splitter.dragElement(); // Enable dragging between the two panels

    } else if (direction === 'bottom' || direction === 'top') {
        // Split the panel vertically
        panelDiv.classList.add('split-column'); // Add a class for styling
        if (direction === 'bottom') {
            panelDiv.appendChild(panel1Div); // Move the current panel to the new panel
            // splitter = new Splitter('horizontal', panelDiv);
            panelDiv.appendChild(panel2Div); // Append the new panel UI
        } else if (direction === 'top') {
            panelDiv.appendChild(panel2Div); // Move the current panel to the new panel
            // splitter = new Splitter('horizontal', panelDiv);
            panelDiv.appendChild(panel1Div); // Append the new panel UI
        }

        const gutter = newHTMLElement('div', null, 
            { className: 'gutter gutter-row' },
            { 'grid-row': '2' }
        )
        panelDiv.insertBefore(gutter, panelDiv.lastChild);
        split.addRowGutter(gutter, 1);
        console.log(split);
        // splitter.dragElement(); // Enable dragging between the two panels

    } else {
        throw new Error('Invalid direction for splitting panel');
    }

    return { panel1: panel1Div, panel2: panel2Div };
}


export function removePanel(panelDiv) {
    const parentDiv = panelDiv.parentElement;
    if (!parentDiv) return;

    if (parentDiv.classList.contains('layout-container')) {
        // If the panel is the only one in the layout, remove it
        parentDiv.removeChild(panelDiv);
    }
    else if (parentDiv.classList.contains('split-row') || parentDiv.classList.contains('split-column')) {
        // Remove splitter
        if (parentDiv.firstChild === panelDiv) {
            parentDiv.removeChild(panelDiv.nextSibling);
        } else {
            parentDiv.removeChild(panelDiv.previousSibling);
        }

        panelDiv.remove(); // Remove the panel
    }

    if (parentDiv.getElementsByClassName('panel-container').length === 1) {
        // If one panel remains, move the panel up one level
        const child = parentDiv.firstChild; // Get the first child of the parent
        const parentParent = parentDiv.parentNode; // Get the parent of the parent
        child.style.margin = '0'; // Reset margin
        child.style.border = 'none'; // Reset border
        child.style.width = '100%'; // Reset width to full
        child.style.height = '100%'; // Reset height to full

        if (parentParent.firstChild === parentDiv) {
            parentParent.insertBefore(child, parentDiv); // Insert the child before the parent
            if (parentParent.classList.contains('split-row')) {
                child.style.marginRight = '-8px'; // Adjust margin for row split
                child.style.borderRight = '4px solid gray'; // Add a border to the right side
            } else if (parentParent.classList.contains('split-column')) {
                child.style.marginBottom = '-8px'; // Adjust margin for column split
                child.style.borderBottom = '4px solid gray'; // Add a border to the bottom side
            }
        } else {
            parentParent.appendChild(child);
        }

        parentDiv.remove(); // Remove the empty parent container
    }
}