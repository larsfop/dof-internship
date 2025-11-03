import { Chatbox, Pdf } from "./content.js";
import { splitPanel, removePanel, toggleHidden } from "./utils/html-helper-functions.js";

export class Tabs {
    constructor(sessionID = null) {
        this.id = sessionID ? sessionID : crypto.randomUUID();

        this.boundDragHandler = this.dragHandler.bind(this);
        this.boundDragEnterHandler = this.dragEnterHandler.bind(this);
        this.boundDragOverHandler = this.dragOverHandler.bind(this);

        this.createUI(); // Create UI elements for tabs and window

        this.createListeners(); // Set up event listeners for tab interactions
    }

    setupContent(type, data = null) {
        if (type === 'chatbox') {
            this.content = new Chatbox(this.id, data);
        } else if (type === 'pdf') {
            this.content = new Pdf(data, this.id);
        }
    }

    setupChatSender(history) {
        if (this.content instanceof Chatbox) {
            this.content.setupChatSender(history);
        }
    }

    createListeners() {
        this.tabDiv.addEventListener('dragstart', this.dragStartHandler.bind(this));
    }

    createUI() {
        // Create a container for the tabs
        this.tabDiv = document.createElement('div');
        this.tabDiv.id = `tab:${this.id}`; // Unique ID for each tab
        // this.tabDiv.dataset.index = this.tabIdx; // Store the index of the tab in a data attribute
        this.tabDiv.className = 'tab'; // Add a class for styling if needed

        const div = document.createElement('div');
        div.className = 'tab-text';
        div.textContent = `${this.id}`; // Set the tab text
        this.tabDiv.appendChild(div); // Append the text to the tab
        this.tabDiv.draggable = true;

        this.tabDiv.onclick = (e) => {
            if (!this.tabDiv) return;
            this.changeTab(); // Change to the clicked tab
        };

        // Create a close button for the tab
        this.closeButton = document.createElement('button');
        this.closeButton.className = 'tab-close';
        this.closeButton.textContent = '×'; // Close button symbol
        this.closeButton.onclick = this.removeTab.bind(this);
        this.tabDiv.appendChild(this.closeButton); // Append the close button to the tab
    }

    appendContainer(panelDiv) {
        const containers = panelDiv.children; // Get the children of the panel container
        this.tabsContainer = containers[0].firstChild; 

        this.tabsContainer.appendChild(this.tabDiv); // Insert before the last child to keep the new tab at the end
        containers[1].insertBefore(this.content.mainContainer, containers[1].lastChild); // Append the content's main container to the content container
    }

    dragStartHandler(e) {
        e.dataTransfer.setDragImage(this.tabDiv, -20, -20);
        this.changeTab();

        this.tabDiv.classList.add('dragging');
        this.tabDiv.classList.add('no-transition');

        const rect = this.tabDiv.getBoundingClientRect();
        this.tabBoundingRect = {
            left: rect.left,
            right: rect.right,
            width: rect.width
        }

        this.tabDiv.addEventListener('drag', this.boundDragHandler);
        this.tabDiv.addEventListener('dragend', this.dragEndHandler.bind(this), { once: true });
        document.addEventListener('drop', this.dropHandler.bind(this), { once: true });

        for (const tabContainer of document.querySelectorAll('.tabs-list')) {
            tabContainer.addEventListener('dragenter', this.boundDragEnterHandler);
            tabContainer.addEventListener('dragover', this.boundDragOverHandler);
        }

    }

    dragHandler(e) {
        if (e.clientY < 0 || e.clientY >= 32) return;

        function clamp(value, min, max) {
            return Math.min(Math.max(value, min), max);
        }

        const { left, right, width } = this.tabBoundingRect;

        let rect = this.tabsContainer.getBoundingClientRect();
        const xMin = rect.left;
        const xMax = rect.right;

        const x = left + width / 2;

        const dx = clamp(e.clientX - x, xMin - left, xMax - right);

        this.tabDiv.style.transform = `translateX(${dx}px)`;
    }

    dragOverHandler(e) {
        e.preventDefault();
        const width = this.tabBoundingRect.width;
        const tabTransform = parseFloat(this.tabDiv.style.transform.slice(11)) || 0;
        const tabs = Array.from(this.tabsContainer.children);
        const tabIdx = tabs.indexOf(this.tabDiv);

        for (let i = 0; i < tabs.length; i++) {
            const otherTab = tabs[i];
            if (otherTab === this.tabDiv) continue;

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

    dragEnterHandler(e) {
        e.preventDefault();

        const tabContainer = e.target.closest('.tabs-list');
        if (!tabContainer) return;
        if (tabContainer === this.tabsContainer) return;

        requestAnimationFrame(() => {
            this.tabDiv.style.transform = '';
            const rect = this.tabDiv.getBoundingClientRect();
            this.tabBoundingRect = {
                left: rect.left,
                right: rect.right,
                width: rect.width
            };
        });

        this.tabsContainer.querySelectorAll('.tab').forEach((t) => {
            t.style.transform = ''; // Reset the transform for all tabs in the old container
        });
        this.moveTab(tabContainer.closest('.panel-container'));

        this.tabsContainer = tabContainer;

    }

    dropHandler(e) {
        e.preventDefault();
        const target = e.target;

        if (!target.classList.contains('window-highlight')) return;
        target.classList.remove('highlight-display');

        const panelDiv = target.closest('.panel-container');
        if (target.classList.contains('window-highlight') && !target.classList.contains('highlight-center')) {
            const direction = target.classList[1].split('-')[1];

            const { panel1, panel2 } = splitPanel(panelDiv, direction);
            this.moveTab(panel2);

            const tabContainer = panelDiv.querySelector('.tab-container');
            const contentContainer = panelDiv.querySelector('.window-container');

            panel1.appendChild(tabContainer);
            panel1.appendChild(contentContainer);
        } else if (!panelDiv.contains(this.tabDiv)) {
            this.moveTab(target.closest('.panel-container'));
        }
    }

    dragEndHandler(e) {
        const tabTransform = parseFloat(this.tabDiv.style.transform.slice(11)) || 0;
        // const tabs = Array.from(this.tabsContainer.children);
        const tabs = document.querySelectorAll('.tab');

        // 1. Remove transitions before DOM changes
        for (let t of tabs) {
            if (t === this.tabDiv) {
                t.classList.remove('no-transition');
            } else {
                t.classList.add('no-transition');
            }
        }

        // 2. Move tab in DOM and reset transforms
        if (tabTransform < 0) {
            for (let i = 0; i < tabs.length; i++) {
                const t = tabs[i];
                if (t.style.transform && t !== this.tabDiv) {
                    this.tabsContainer.insertBefore(this.tabDiv, t);
                    break;
                }
            }
        } else {
            for (let i = tabs.length - 1; i >= 0; i--) {
                const t = tabs[i];
                if (t.style.transform && t !== this.tabDiv) {
                    this.tabsContainer.insertBefore(this.tabDiv, t.nextSibling);
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
            this.tabDiv.classList.remove('dragging');
        }, 30);


        this.tabDiv.removeEventListener('drag', this.boundDragHandler);

        for (const tabContainer of document.querySelectorAll('.tabs-list')) {
            tabContainer.removeEventListener('dragenter', this.boundDragEnterHandler);
            tabContainer.removeEventListener('dragover', this.boundDragOverHandler);
        }

        // Remove empty panels
        const tabLists = document.querySelectorAll('.tabs-list');
        for (let tabList of tabLists) {
            if (tabList.children.length === 0) {
                removePanel(tabList.closest('.panel-container'));
            }
        }
    }

    changeTab() {
        const parent = this.tabDiv.parentNode; // Get the parent container of the tab
        const activeTab = parent.getElementsByClassName('active')[0];

        if (activeTab === this.tabDiv) return;

        if (activeTab) {
            this.toggleActive(activeTab, false); // Deactivate the currently active tab
        }
        this.toggleActive(this.tabDiv, true); // Activate the clicked tab
    }

    toggleActive(tabDiv, force = null) {
        const id = tabDiv.id.replace('tab:', '');
        const content = document.getElementById(`content:${id}`);

        const active = tabDiv.classList.toggle('active', force); // Toggle the active class for the tab
        if (active) {
            toggleHidden(content, false);
            // insert new active content as first child
            // The order of the content elements is used for active tab memory
            content.parentElement.insertBefore(content, content.parentElement.firstChild);
        } else {
            toggleHidden(content, true);
        }
    }

    moveTab(newPanelDiv) {
        const newTabsContainer = newPanelDiv.querySelector('.tabs-list');
        const newContentContainer = newPanelDiv.querySelector('.window-container');

        newTabsContainer.appendChild(this.tabDiv); // Move the tab to the new panel's tab container
        newContentContainer.insertBefore(this.content.mainContainer, newContentContainer.firstChild); // Move the content to the new panel's content container

        this.changeTab(); // Change to the moved tab

        if (this.tabsContainer.children.length != 0) {
            const element = this.tabsContainer.parentNode.nextSibling.firstChild;
            const id = element.id.replace('content:', '');
            const oldTab = document.getElementById(`tab:${id}`);
            this.toggleActive(oldTab, true); // Activate the next tab if it exists
        }

        this.tabsContainer = newTabsContainer; // Update the tabs container reference

        // Update bounding rect
        const rect = this.tabDiv.getBoundingClientRect();
        this.tabBoundingRect = {
            left: rect.left,
            right: rect.right,
            width: rect.width
        };
        
    }

    removeTab() {
        this.tabDiv.remove(); // Remove the tab from the DOM

        if (this.tabsContainer.children.length === 0) {
            const panelDiv = this.tabsContainer.closest('.panel-container');
            panelDiv.remove(); // Remove the panel if no tabs are left
            return;
        }

        if (this.tabDiv.classList.contains('active')) {
            const id = this.content.mainContainer.nextSibling.id.replace('content:', '');
            const nextTab = document.getElementById(`tab:${id}`);
            this.toggleActive(nextTab, true); // Activate the next tab if it exists
        }

        this.content.mainContainer.remove(); // Remove the content from the DOM
        this.content = null; // Clear the content reference
        this.tabDiv = null; // Clear the tab reference
    }


}  
    
