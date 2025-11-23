import { newTab } from './tab.js';
import { newHTMLElement, setLastActive, removePanel } from './utils/html-helper-functions.js';


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
