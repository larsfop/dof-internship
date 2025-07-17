export class Tabs {
    constructor(panelIdx, tabIdx, content, panel) {
        this.panelIdx = panelIdx; // Store the index of the tab
        this.tabIdx = tabIdx; // Index for the next tab to be added
        this.content = content; // Store the content of the tab
        this.panel = panel; // Store the panel reference

        this.createUI(); // Create UI elements for tabs and window
        this.createListeners(); // Create event listeners for drag and drop
    }

    createListeners() {
        this.tabDiv.addEventListener('dragstart', (e) => {
            const self = this; // Store reference to the current instance
            this.tabDiv.classList.add('dragging'); // Add a class to indicate
            const tabs = document.getElementsByClassName('tab');
            [...tabs].forEach((tab, index) => {
                tab.addEventListener('dragenter', (e) => {
                    e.preventDefault(); // Prevent default dragover behavior
                    const div = document.createElement('div');
                    div.className = 'tab-hover';
                    tab.appendChild(div); // Append a div to the tab to indicate hover
                });

                tab.addEventListener('dragleave', (e) => {
                    tab.style.backgroundColor = ''; // Reset background color on drag leave
                    tab.removeChild(tab.lastChild)
                });
            })

            function moveTab(e, container) {
                console.log(e.target, container)
                const panelChildren = container ? container.children : e.target.closest('.panel-container').children;
                console.log(panelChildren);
                const tabList = panelChildren[0]; // Get the tabs list container
                const content = panelChildren[1]; // Get the content container
                const activeTab = tabList.querySelector('.active'); // Get the currently active tab

                // Select new active tab if the moved tab was active
                if (self.tabDiv.classList.contains('active') && !tabList.contains(self.tabDiv)) {
                    const srcTabs = Array.from(self.tabDiv.closest('.tabs-list').children);
                    srcTabs.pop(); // Remove the new tab button from the source tabs
                    const srcIdx = srcTabs.indexOf(self.tabDiv);

                    if (srcTabs.length > 1) {
                        if (srcIdx === 0) {
                            self.toggleActive(true, srcTabs[1]); // Activate the next tab if the first tab is dropped
                        } else {
                            self.toggleActive(true, srcTabs[srcIdx - 1]); // Activate the previous tab if not the first
                        }
                    }
                }

                // Move the tab and content to the new position
                if (e.target.classList.contains('tab')) {
                    tabList.insertBefore(self.tabDiv, e.target); // Move the tab to the new position
                    content.insertBefore(self.content.mainContainer, content.lastChild); // Move the content to the new position
                } else {
                    tabList.insertBefore(self.tabDiv, tabList.lastChild); // Append the tab to the end of the list
                    content.insertBefore(self.content.mainContainer, content.lastChild); // Move the content to the new position
                }

                // Deactivate the currently active tab if it exists and activate the moved tab
                if (activeTab) {
                    self.toggleActive(false, activeTab); // Deactivate the currently active tab
                }
                self.toggleActive(true); // Activate the newly dropped tab
            }
                
            
            function handleDrop(e) {
                e.preventDefault();
                const target = e.target; // Get the target element where the tab is dropped
                target.classList.remove('highlight-display'); // Remove the class indicating the dragenter event

                if (target.classList.contains('window-highlight') && !target.classList.contains('highlight-center')) {
                    const direction = target.classList[1].split('-')[1]; // Get the direction from the class name
                    const panelDiv = e.target.closest('.panel-container');

                    const { panel1, panel2 } = self.panel.splitPanel(direction, panelDiv); // Split the panel to the right
                    moveTab(e, panel2)

                    // Move the tabs list and content to the correct child panel
                    const tabsList = panelDiv.querySelector('.tabs-list');
                    const contents = panelDiv.querySelector('.window-container');
                    panel1.appendChild(tabsList); // Move the tabs list to the new panel
                    panel1.appendChild(contents); // Move the content container to the new panel
                }
                else {
                    moveTab(e); // Move the tab to the new position
                }


                document.removeEventListener('drop', handleDrop); // Remove the event listener after handling the drop
                const windowsHighlights = document.getElementsByClassName('window-highlight');
                [...windowsHighlights].forEach((windowsHighlight) => {
                    windowsHighlight.style.pointerEvents = 'none'; // Disable pointer events on window highlights
                    [...windowsHighlight.children].forEach((div) => {
                        div.removeEventListener('dragenter', handleDragenter);
                        div.removeEventListener('dragleave', handleDragleave); // Handle drag leave on window containers
                    })
                })  
            }


            function handleDragenter(e) {
                e.preventDefault(); // Prevent default dragover behavior
                
                e.target.classList.add('highlight-display'); // Add a class to indicate the dragenter event
            }

            function handleDragleave(e) {
                e.preventDefault(); // Prevent default dragleave behavior

                e.target.classList.remove('highlight-display'); // Remove the class indicating the dragenter event
            }

            document.addEventListener('drop', handleDrop);
            const windowsHighlights = document.getElementsByClassName('window-highlight');
            [...windowsHighlights].forEach((windowsHighlight) => {
                windowsHighlight.style.pointerEvents = 'auto'; // Enable pointer events on window highlights
                [...windowsHighlight.children].forEach((div) => {
                    div.addEventListener('dragenter', handleDragenter);
                    div.addEventListener('dragleave', handleDragleave); // Handle drag leave on window containers
                })
            })  

        })

        this.tabDiv.addEventListener('dragend', (e) => {
            this.tabDiv.classList.remove('dragging');
        })

        this.tabDiv.addEventListener('drop', (e) => {
            e.preventDefault(); // Prevent default drop behavior
            const div = document.getElementsByClassName('tab-hover');
            [...div].forEach((d) => {
                d.remove(); // Remove the hover indicator
            });
        })


    }

    createUI() {
        // Create a container for the tabs
        this.tabDiv = document.createElement('div');
        this.tabDiv.id = `t${this.tabIdx}`; // Unique ID for each tab
        this.tabDiv.className = 'tab'; // Add a class for styling if needed
        this.tabDiv.className += window.matchMedia('(prefers-color-scheme: dark)').matches ? ' tab-dark-mode' : ' tab-light-mode'; // Add class based on color scheme
        this.tabDiv.textContent = `Tab ${this.tabIdx + 1}`;
        this.tabDiv.draggable = true;

        this.tabDiv.onclick = (e) => {
            e.stopPropagation(); // Prevent event bubbling
            this.changeTab(); // Change to the clicked tab
        };

        // Create a close button for the tab
        const closeButton = document.createElement('button');
        closeButton.className = 'tab-close';
        closeButton.textContent = '×'; // Close button symbol
        closeButton.onclick = (e) => {
            e.stopPropagation(); // Prevent event bubbling
            const parent = this.tabDiv.parentNode; // Get the parent container of the tab
            const contentParent = this.content.mainContainer.parentNode; // Get the parent container of the content

            // Remove the tab and its associated content
            parent.removeChild(this.tabDiv);
            contentParent.removeChild(this.content.mainContainer);

            // Activate another tab if the closed tab was active
            const remainingTabs = parent.getElementsByClassName('tab');
            if (this.tabDiv.classList.contains('active') && remainingTabs.length > 0) {
            this.toggleActive(true, remainingTabs[0]); // Activate the first remaining tab
            }
        };

        this.tabDiv.appendChild(closeButton); // Append the close button to the tab

        this.content.mainContainer.id = `c${this.tabIdx}`; // Set a unique ID for the content container
    }

    appendContainer(panelDiv) {
        const containers = panelDiv.children; // Get the children of the panel container
        containers[0].insertBefore(this.tabDiv, containers[0].lastChild); // Insert before the last child to keep the new tab at the end
        containers[1].insertBefore(this.content.mainContainer, containers[1].lastChild); // Append the content's main container to the content container
    }

    changeTab() {
        const parent = this.tabDiv.parentNode; // Get the parent container of the tab
        const activeTab = parent.getElementsByClassName('active')[0]; // Get the

        if (activeTab) {
            if (activeTab !== this.tabDiv) {
                this.toggleActive(false, activeTab); // Deactivate the currently active tab
            }
        }
        this.toggleActive(true); // Activate the clicked tab
    }

    toggleActive(force = null, tabDiv = this.tabDiv) {
        const idx = Number(tabDiv.id.split('')[1]); // Extract the index from the ID
        const content = document.getElementById(`c${idx}`); // Get the content

        const active = tabDiv.classList.toggle('active', force); // Toggle the active class for the tab
        if (active) {
            content.style.display = 'block'; // Show content when active
        } else {
            content.style.display = 'none'; // Hide content when inactive
        }
    }

    renderActive(active) {
        // Highlight current tab with adaptive color
        if (active) {
            this.tabDiv.
            this.tabDiv.style.background = window.matchMedia('(prefers-color-scheme: dark)').matches ? '#333' : '#e0e0e0';
            this.tabDiv.style.color = window.matchMedia('(prefers-color-scheme: dark)').matches ? '#fff' : '#222';
            this.tabDiv.style.fontWeight = 'bold';
            this.tabDiv.style.boxShadow = window.matchMedia('(prefers-color-scheme: dark)').matches ? '0 2px 8px #1118' : '0 2px 8px #ccc8';
        } else {
            this.tabDiv.style.background = window.matchMedia('(prefers-color-scheme: dark)').matches ? '#222' : '#fff';
            this.tabDiv.style.color = window.matchMedia('(prefers-color-scheme: dark)').matches ? '#bbb' : '#222';
            this.tabDiv.style.fontWeight = 'normal';
            this.tabDiv.style.boxShadow = 'none';
        }
    }

}  
    
