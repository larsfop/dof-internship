import { newTab } from './tab.js';
import { newHTMLElement, setLastActive } from './utils/html-helper-functions.js';

const panelUI = "<div class='tab-container'><div class='tabs-list'></div><button class='tab-new' title='New Tab'>+</button></div><div class='window-container'><div class='window-highlight'><div class='highlight-top'></div><div class='highlight-right'></div><div class='highlight-bottom'></div><div class='highlight-left'></div></div></div>";

export function createPanel(parentDiv, fill = true) {
    const id = crypto.randomUUID();
    
    // Create a container for the panels
    const panelContainer = newHTMLElement('div', parentDiv, {
        className: 'panel-container',
        id: `panel-${id}`
    });
    setLastActive(panelContainer);

    // Fill the panel with new tab and window containers
    if (fill) {
        // Create a container for the tabs
        const tabContainer = newHTMLElement('div', panelContainer, {
            className: 'tab-container'
        });

        const tabsList = newHTMLElement('div', tabContainer, {
            className: 'tabs-list'
        });

        // Make horizontal scroll default on mouse wheel
        tabsList.addEventListener('wheel', (e) => {
            if (e.deltaY !== 0) {
                e.preventDefault();
                tabsList.scrollLeft += e.deltaY;
            }
        });
        const newTabBtn = newHTMLElement('button', tabContainer, {
            className: 'tab-new',
            textContent: '+',
            title: 'New Tab'
        });
        newTabBtn.onclick = function(e) {
            const panelDiv = e.target.closest('.panel-container');
            newTab(panelDiv, 'chatbot');
        };

        // Create a container for the window content
        const windowContainer = newHTMLElement('div', panelContainer, {
            className: 'window-container'
        });


        // Setup window highlight elements for tab drag-and-drop
        const highlight = newHTMLElement('div', windowContainer, {
            className: 'window-highlight'
        });

        for (const sheet of document.styleSheets) {
            if (sheet.href && sheet.href.endsWith('styles.css')) {
                for (const rule of sheet.cssRules) {
                    if (rule.selectorText && rule.selectorText.startsWith('.window-highlight.') && !rule.selectorText.endsWith('display')) {
                        newHTMLElement('div', highlight, {
                            className: rule.selectorText.replaceAll('.', ' ')
                        });
                    }
                }
            }
        }
    }

    return panelContainer;
}


export function cleanPanels() {
    const tabContainers = document.querySelectorAll('.tabs-list');
    for (const tabContainer of tabContainers) {
        if (tabContainer.hasChildNodes()) continue;

        const panel = tabContainer.closest('.panel-container');
        removePanel(panel);
    }

    // If no panels remain, quit the application
    const panelContainers = document.querySelectorAll('.panel-container')
    if (panelContainers.length === 0) window.app.quit();
}


function removePanel(panelDiv) {
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
    const gutter = document.createElement('div');
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

        gutter.className = 'gutter gutter-col';
        gutter.style.gridColumn = '2';

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

        gutter.className = 'gutter gutter-row';
        gutter.style.gridRow = '2';

        panelDiv.insertBefore(gutter, panelDiv.lastChild);
        split.addRowGutter(gutter, 1);

    } else {
        throw new Error('Invalid direction for splitting panel');
    }

    return { panel1, panel2 };
}

