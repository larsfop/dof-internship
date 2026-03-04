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

export function documentBodyClickHandler(e) {
    const target = e.target;
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
}

export function handleColorThemeChange(e) {
    const isDarkMode = e.matches;
    const themeButtonImg = document.getElementById('light-dark-mode').querySelector('img');
    if (isDarkMode) {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeButtonImg.src = 'assets/light-mode.svg';
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        themeButtonImg.src = 'assets/dark-mode.svg';
    }
}