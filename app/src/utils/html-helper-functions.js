import { createPanel } from '../panel.js';

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
            if (key === 'dataset') {
                for (const [dataKey, dataValue] of Object.entries(value)) {
                    element.dataset[dataKey] = dataValue;
                }
            } else {
                element[key] = value;
            }
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
 * @param {string} [className='hidden'] - The class name to toggle.
 */
export function toggleHidden(element, force = null, className = 'hidden') {
    const isHidden = force === null ? element.classList.toggle(className) : element.classList.toggle(className, force);
    if (isHidden) {
        element.setAttribute('inert', 'true');
    } else {
        element.removeAttribute('inert');
    }
}

/** Set the last active panel element. 
 * @param {HTMLElement} element - The panel element to set as last active.
*/
export function setLastActive(element) {
    const panels = document.querySelectorAll('.panel-container');
    for (const panel of panels) {
        panel.classList.remove('last-active');
    }
    element.classList.add('last-active');
}


/**
 * Get the corresponding tab or chat container element by ID.
 * @param {HTMLElement} element - The element to find the counterpart for.
 * @returns {HTMLElement} The corresponding element.
 */
export function getOtherElementByID(element) {
    if (element.classList.contains('chat-container') || element.classList.contains('pdf-viewer')) {
        const id = element.id.replace('content:', '')
        return document.getElementById(`tab:${id}`);
    } else if (element.classList.contains('tab')) {
        const id = element.id.replace('tab:', '')
        return document.getElementById(`content:${id}`);
    } else {
        throw new Error('Element must be either chat-container or tab');
    }
}


export function documentBodyClickHandler(e) {
    const target = e.target;
    const chatMenus = document.querySelectorAll('.chat-menu-container');
    console.log(target);
    if (target.classList.contains('chat-settings')) return;

    for (const menu of chatMenus) {
        if (menu.contains(target)) continue;
        const children = Array.from(menu.children);
        for (const child of children) {
            const rect = child.getBoundingClientRect();
            if (e.clientX >= rect.left && e.clientX <= rect.right &&
                e.clientY >= rect.top && e.clientY <= rect.bottom) {
                return; // Click inside the menu, do nothing
            }

            toggleHidden(child, true);
        }
    }

    const activePanel = target.closest('.panel-container');
    if (activePanel) {
        setLastActive(activePanel);
    }
}


export function scrollInputHandler(e, scrollElement) {
    e.preventDefault();
    const step = Number(scrollElement.step) || 1;
    const min = scrollElement.min !== '' ? Number(scrollElement.min) : -Infinity;
    const max = scrollElement.max !== '' ? Number(scrollElement.max) : Infinity;
    let value = Number(scrollElement.value) || 0;

    if (e.deltaY < 0) {
        // Scroll up: increase value
        value = Math.min(value + step, max);
    } else {
        // Scroll down: decrease value
        value = Math.max(value - step, min);
    }
    scrollElement.value = value;
    return value;
}


export function splitPanel(panelDiv, direction) {
    const panel1 = createPanel(panelDiv, false); // Create new empty panel
    const panel2 = createPanel(panelDiv, true); // Create new filled panel

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
            panelDiv.appendChild(panel1); // Move the current panel to the new panel
            panelDiv.appendChild(panel2); // Append the new panel UI
        } else if (direction === 'left') {
            panelDiv.appendChild(panel2); // Move the current panel to the new panel
            panelDiv.appendChild(panel1); // Append the new panel UI
        }

        const gutter = newHTMLElement('div', null, 
            { className: 'gutter gutter-col' },
            { 'grid-column': '2' }
        )
        panelDiv.insertBefore(gutter, panelDiv.lastChild);
        split.addColumnGutter(gutter, 1);

    } else if (direction === 'bottom' || direction === 'top') {
        // Split the panel vertically
        panelDiv.classList.add('split-column'); // Add a class for styling
        if (direction === 'bottom') {
            panelDiv.appendChild(panel1); // Move the current panel to the new panel
            panelDiv.appendChild(panel2); // Append the new panel UI
        } else if (direction === 'top') {
            panelDiv.appendChild(panel2); // Move the current panel to the new panel
            panelDiv.appendChild(panel1); // Append the new panel UI
        }

        const gutter = newHTMLElement('div', null, 
            { className: 'gutter gutter-row' },
            { 'grid-row': '2' }
        )
        panelDiv.insertBefore(gutter, panelDiv.lastChild);
        split.addRowGutter(gutter, 1);

    } else {
        throw new Error('Invalid direction for splitting panel');
    }

    return { panel1, panel2 };
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

    if (parentDiv.children.length === 1) {
        // If one panel remains, move the panel up one level
        const child = parentDiv.firstChild; // Get the first child of the parent
        const parentParent = parentDiv.parentNode; // Get the parent of the parent

        parentParent.insertBefore(child, parentDiv); // Move the child up one level

        parentDiv.remove(); // Remove the empty parent container
    }
}