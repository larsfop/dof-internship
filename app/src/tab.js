import { setupContent } from "./content.js";
import { cleanPanels } from "./panel.js";
import { newHTMLElement, splitPanel, toggleHidden, getOtherElementByID } from "./utils/html-helper-functions.js";

export function newTab(
    panelDiv, 
    type = 'chatbot', 
    data = null, 
    sessionID = null, 
    sessionName = null
) {
    const id = sessionID ? sessionID : crypto.randomUUID();
    const name = sessionName ? sessionName : "New Tab";

    const tabDiv = tabUI(panelDiv, id, name);

    const windowContainer = panelDiv.querySelector('.window-container');
    setupContent(windowContainer, type, data, id, sessionName);

    tabDiv.addEventListener('dragstart', dragStartHandler);

    if (type == 'chatbot') {
        changeTab(tabDiv); // Activate the new tab
    }

    return id;
}

function tabUI(panelDiv, id, name) {
    const tabsList = panelDiv.querySelector('.tabs-list');
    const tabDiv = newHTMLElement('div', tabsList, {
        className: 'tab',
        id: `tab:${id}`,
        draggable: true,
        onclick: function() {
            if (!tabDiv) return;
            changeTab(tabDiv); // Change to the clicked tab
        }
    });

    newHTMLElement('div', tabDiv, {
        className: 'tab-text',
        textContent: name
    });

    newHTMLElement('button', tabDiv, {
        className: 'tab-close',
        textContent: '×', // Close button symbol
        onclick: function(e) {
            e.stopPropagation(); // Prevent triggering the tab click event
            removeTab(tabDiv); // Remove the tab
        }
    });
    return tabDiv;
}

export function changeTab(tabDiv) {
    const parent = tabDiv.parentNode; // Get the parent container of the tab
    const activeTab = parent.getElementsByClassName('active')[0];

    if (activeTab === tabDiv) return;

    if (activeTab) {
        toggleActive(activeTab, false); // Deactivate the currently active tab
        toggleHidden(activeTab.lastChild, true); // Hide close button of inactive tab
    }
    toggleActive(tabDiv, true); // Activate the clicked tab
    toggleHidden(tabDiv.lastChild, false); // Show close button of active tab
}


function toggleActive(tabDiv, force = null) {
    const content = getOtherElementByID(tabDiv);

    const active = force === null ? tabDiv.classList.toggle('active') : tabDiv.classList.toggle('active', force); // Toggle the active class for the tab
    if (active) {
        toggleHidden(content, false);
        // insert new active content as first child
        content.parentElement.insertBefore(content, content.parentElement.firstChild);
        const input = content.querySelector('input');
        if (input) input.focus();
    } else {
        toggleHidden(content, true);
    }
}


function moveTab(newPanelDiv, tabDiv) {
    const newTabsContainer = newPanelDiv.querySelector('.tabs-list');
    const newContentContainer = newPanelDiv.querySelector('.window-container');

    const oldTabsContainer = tabDiv.parentNode;

    const content = getOtherElementByID(tabDiv);
    newTabsContainer.appendChild(tabDiv); // Move the tab to the new panel's tab container
    newContentContainer.insertBefore(content, newContentContainer.firstChild); // Move the content to the new panel's content container

    changeTab(tabDiv); // Change to the moved tab

    if (oldTabsContainer.children.length != 0) {
        const element = oldTabsContainer.parentNode.nextSibling.firstChild;
        const oldTab = getOtherElementByID(element);
        toggleActive(oldTab, true); // Activate the next tab if it exists
        toggleHidden(oldTab.lastChild, false); // Show close button of active tab
    }
}


export function loadLastTab() {
    const historyEntries = document.getElementsByClassName('history-entry');
    if (historyEntries.length  === 0) return;

    for (const entry of historyEntries) {
        const sessionID = entry.id.replace('history:', '');
        const contentDiv = document.getElementById(`content:${sessionID}`);
        if (contentDiv) continue; // Skip if tab is already open
        entry.click();
        break;
    }
}


function removeTab(tabDiv) {
    const tabContainer = tabDiv.parentNode;
    const content = getOtherElementByID(tabDiv);
    const active = tabDiv.classList.contains('active');

    tabDiv.remove(); // Remove the tab from the DOM

    // Remove empty panels
    cleanPanels();
    if (tabContainer.children.length === 0) return;

    // Update active tab if needed
    if (active) {
        const nextTab = getOtherElementByID(content.nextSibling);
        toggleActive(nextTab, true); // Activate the next tab if it exists
    }

    content.remove(); // Remove the content from the DOM
}


/* -------------------------------------------------------
                        Tab Events
------------------------------------------------------- */

/**
 * Handle tab drag start events for moving and rearranging tabs
 * @param {DragEvent} e 
 */
function dragStartHandler(e) {
    const tabDiv = this;
    var oldTabsContainer = tabDiv.parentNode;

    e.dataTransfer.setDragImage(tabDiv, -20, -20);
    changeTab(tabDiv);

    tabDiv.classList.add('dragging');
    tabDiv.classList.add('no-transition');

    const rect = tabDiv.getBoundingClientRect();
    var tabBoundingRect = {
        left: rect.left,
        right: rect.right,
        width: rect.width
    }

    /**
     * Handle tab drag events for visual movement
     * @param {DragEvent} e 
     */
    function dragHandler(e) {
        if (e.clientY < 0 || e.clientY >= 32) return;

        function clamp(value, min, max) {
            return Math.min(Math.max(value, min), max);
        }

        const { left, right, width } = tabBoundingRect;

        let rect = tabDiv.parentNode.getBoundingClientRect();
        const xMin = rect.left;
        const xMax = rect.right;

        const x = left + width / 2;

        const dx = clamp(e.clientX - x, xMin - left, xMax - right);

        tabDiv.style.transform = `translateX(${dx}px)`;
    }

    /**
     * Handle tab drag over events over other tabs in container
     * @param {DragEvent} e
     */
    function dragOverHandler(e) {
        e.preventDefault();
        const width = tabBoundingRect.width;
        const tabTransform = parseFloat(tabDiv.style.transform.slice(11)) || 0;
        const tabs = Array.from(oldTabsContainer.children);
        const tabIdx = tabs.indexOf(tabDiv);

        for (let i = 0; i < tabs.length; i++) {
            const otherTab = tabs[i];
            if (otherTab === tabDiv) continue;

            const otherTabRect = otherTab.getBoundingClientRect();
            const otherTabCenter = otherTabRect.left + otherTabRect.width / 2;

            if (tabTransform > 0) {
                // Moving right
                if (i > tabIdx) {
                    if (e.clientX >= otherTabCenter) {
                        otherTab.style.transform = `translateX(-${width}px)`;
                    } else {
                        otherTab.style.transform = '';
                    }
                } else {
                    otherTab.style.transform = '';
                }
            } else {
                // Moving left
                if (i < tabIdx) {
                    if (e.clientX < otherTabCenter) {
                        otherTab.style.transform = `translateX(${width}px)`;
                    } else {
                        otherTab.style.transform = '';
                    }
                } else {
                    otherTab.style.transform = '';
                }
            }
        }
    }

    /**
     * Handle tab drag enter events into other tab containers
     * @param {DragEvent} e 
     */
    function dragEnterHandler(e) {
        e.preventDefault();

        const newTabsContainer = e.target.closest('.tabs-list');
        if (!newTabsContainer) return;
        if (newTabsContainer === oldTabsContainer) return;

        requestAnimationFrame(() => {
            tabDiv.style.transform = '';
            const rect = tabDiv.getBoundingClientRect();
            tabBoundingRect = {
                left: rect.left,
                right: rect.right,
                width: rect.width
            };
        });

        oldTabsContainer.querySelectorAll('.tab').forEach((t) => {
            t.style.transform = ''; // Reset the transform for all tabs in the old container
        });
        moveTab(newTabsContainer.closest('.panel-container'), tabDiv);
        oldTabsContainer = newTabsContainer;

        // Update bounding rect
        const rect = tabDiv.getBoundingClientRect();
        tabBoundingRect = {
            left: rect.left,
            right: rect.right,
            width: rect.width
        };
    }

    /**
     * Handle tab drop events into window highlights
     * @param {DragEvent} e 
     */
    function dropHandler(e) {
        e.preventDefault();
        const target = e.target;

        if (!target.classList.contains('window-highlight')) return;
        target.classList.remove('highlight-display');

        const panelDiv = target.closest('.panel-container');
        if (target.classList.contains('window-highlight') && !target.classList.contains('highlight-center')) {
            const direction = target.classList[1].split('-')[1];

            const { panel1, panel2 } = splitPanel(panelDiv, direction);
            moveTab(panel2, tabDiv);

            const tabContainer = panelDiv.querySelector('.tab-container');
            const contentContainer = panelDiv.querySelector('.window-container');

            panel1.appendChild(tabContainer);
            panel1.appendChild(contentContainer);
        } else if (!panelDiv.contains(tabDiv)) {
            moveTab(target.closest('.panel-container'), tabDiv);
        }

        // Update bounding rect
        const rect = tabDiv.getBoundingClientRect();
        tabBoundingRect = {
            left: rect.left,
            right: rect.right,
            width: rect.width
        };
    }

    /**
     * Handle tab drag end events to finalize position
     */
    function dragEndHandler() {
        const tabTransform = parseFloat(tabDiv.style.transform.slice(11)) || 0;
        const tabs = document.querySelectorAll('.tab');

        // 1. Remove transitions before DOM changes
        for (let t of tabs) {
            if (t === tabDiv) {
                t.classList.remove('no-transition');
            } else {
                t.classList.add('no-transition');
            }
        }

        // 2. Move tab in DOM and reset transforms
        if (tabTransform < 0) {
            for (let i = 0; i < tabs.length; i++) {
                const t = tabs[i];
                if (t.style.transform && t !== tabDiv) {
                    console.log(tabDiv, t)
                    oldTabsContainer.insertBefore(tabDiv, t);
                    break;
                }
            }
        } else {
            for (let i = tabs.length - 1; i >= 0; i--) {
                const t = tabs[i];
                if (t.style.transform && t !== tabDiv) {
                    oldTabsContainer.insertBefore(tabDiv, t.nextSibling);
                    break;
                }
            }
        }

        // Reset transforms
        for (let t of tabs) {
            t.style.transform = '';
        }

        // 3. Restore transitions after the next frame
        setTimeout(() => {
            for (let t of tabs) {
                t.classList.remove('no-transition');
            }
            tabDiv.classList.remove('dragging');
        }, 30);

        tabDiv.removeEventListener('drag', dragHandler);

        for (const tabContainer of document.querySelectorAll('.tabs-list')) {
            tabContainer.removeEventListener('dragenter', dragEnterHandler);
            tabContainer.removeEventListener('dragover', dragOverHandler);
        }

        // Remove empty panels
        cleanPanels();
    }

    tabDiv.addEventListener('drag', dragHandler);
    tabDiv.addEventListener('dragend', dragEndHandler, { once: true });
    document.addEventListener('drop', dropHandler, { once: true });

    for (const tabContainer of document.querySelectorAll('.tabs-list')) {
        tabContainer.addEventListener('dragenter', dragEnterHandler);
        tabContainer.addEventListener('dragover', dragOverHandler);
    }

}

 