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

    const historyMenus = document.querySelectorAll('.history-entry-container-menu');
    for (const menu of historyMenus) {
        if (menu.contains(target)) continue;
        const children = Array.from(menu.children);
        for (const child of children) {
            const rect = child.getBoundingClientRect();
            if (e.clientX >= rect.left && e.clientX <= rect.right &&
                e.clientY >= rect.top && e.clientY <= rect.bottom) {
                return; // Click inside the menu, do nothing
            }
        }
        toggleHidden(menu, true);
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

