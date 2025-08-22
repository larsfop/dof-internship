// --------------------------------------------------------------------------------------
//                          Tab event handler functions
// --------------------------------------------------------------------------------------

// Toggle a tab active or inactive, can be forced for better control
function toggleActive(tab, force = null) {
    const index = tab.dataset.index;
    const content = document.querySelector(`.chat-container[data-index="${index}"], pdf-viewer[data-index="${index}"]`);

    const active = tab.classList.toggle('active', force);
    if (active) {
        content.style.display = 'block';
    } else {
        content.style.display = 'none';
    }
}


function changeTab(tab) {
    const parent = tab.parentElement;
    const activeTab = parent.querySelector('.active');
    if (activeTab === tab) return; // If the tab is already active, do nothing

    if (activeTab) {
        toggleActive(activeTab, false);
    }

    // Activate the new tab and show its content
    toggleActive(tab, true);
}

function moveTab(tab, panel) {
    const index = tab.dataset.index;
    const content = document.querySelector(`.chat-container[data-index="${index}"], .pdf-viewer[data-index="${index}"]`);

    const tabContainer = panel.querySelector('.tabs-list');
    const contentContainer = panel.querySelector('.window-container');

    tabContainer.insertBefore(tab, tabContainer.lastChild);
    contentContainer.insertBefore(content, contentContainer.lastChild);

    changeTab(tab);
}


// Tab visual movement handler
export function tabListEventHandler(e) {
    const tab = e.target.closest('.tab');
    e.dataTransfer.setDragImage(e.target, -20, -20);
    if (!tab) return;

    // Change the dragging tab to active
    changeTab(tab);

    tab.classList.add('dragging'); // Add a class to indicate the tab is being dragged
    tab.classList.add('no-transition');
    var currentTabContainer = tab.parentElement;
    var { left, right, width } = tab.getBoundingClientRect();


    // Function to calculate the valid x position of the tab based on mouse movement and container boundaries
    function dx(e) {

        function clamp(value, min, max) {
            return Math.min(Math.max(value, min), max);
        }

        var rect = currentTabContainer.lastChild.getBoundingClientRect();
        const clampX = rect.left;

        rect = currentTabContainer.getBoundingClientRect();
        const clampXMin = rect.left;
        
        const x = left + width / 2;

        return clamp(e.clientX - x, clampXMin - left, clampX - right);
    }


    function dragHandler(e) {
        e.stopPropagation();
        if (e.clientY <= 24 && e.clientY > 0) { // Check if the mouse is within the window height
            // tab.style.left = `${e.clientX - x}px`; // Center the tab under the mouse cursor
            tab.style.transform = `translateX(${dx(e)}px)`; // Center the tab under the mouse cursor
        }
    }

    function dragOverHandler(e) {
        e.preventDefault();
        const tabRect = tab.getBoundingClientRect();
        const center1 = tabRect.left + tabRect.width / 2;
        const tabTransform = parseFloat(tab.style.transform.slice(11)) || 0;
        const tabs = [...tab.parentElement.querySelectorAll('.tab')];
        const tabIndex = tabs.indexOf(tab);

        // Check if we're moving before or after the hovered tab
        // const shouldInsertBefore = e.clientX < hoverRect.left + hoverRect.width / 2;

        // Move in DOM
        // container.insertBefore(dragging, shouldInsertBefore ? hoverTab : hoverTab.nextSibling);

        if (tabTransform <= 0) {
            for (let i = 0; i < tabs.length; i++) {
                const t = tabs[i];
                const rect = t.getBoundingClientRect();
                const center2 = rect.left + rect.width / 2;
                if (t === tab) {
                    continue;
                } else if (i < tabIndex) {
                    if (center1 <= center2) { // Move the tab to the left
                        t.style.transform = `translateX(${width}px)`;
                    } else {
                        t.style.transform = ''; // Reset the transform for other tabs
                    }
                } else {
                    t.style.transform = ''; // Reset the transform for other tabs
                }
            }
        } else if (tabTransform > 0) {
            for (let i = 0; i < tabs.length; i++) {
                const t = tabs[i];
                const rect = t.getBoundingClientRect();
                const center2 = rect.left + rect.width / 2;
                if (t === tab) {
                    continue;
                } else if (i > tabIndex) {
                    if (center1 > center2) { // Move the tab to the right
                        t.style.transform = `translateX(${-width}px)`;
                    } else {
                        t.style.transform = ''; // Reset the transform for other tabs
                    }
                } else {
                    t.style.transform = ''; // Reset the transform for other tabs
                }
            }
        }

    }

    function dragEndHandler(e) {
        const tabTransform = parseFloat(tab.style.transform.slice(11)) || 0;
        const tabs = [...tab.parentElement.querySelectorAll('.tab')];

        // 1. Remove transitions before DOM changes
        for (let t of tabs) {
            if (t === tab) {
                t.classList.remove('no-transition');
            } else {
                t.classList.add('no-transition');
            }
        }

        // 2. Move tab in DOM and reset transforms
        if (tabTransform < 0) {
            for (let i = 0; i < tabs.length; i++) {
                const t = tabs[i];
                if (t.style.transform && t !== tab) {
                    currentTabContainer.insertBefore(tab, t);
                    break;
                }
            }
        } else {
            for (let i = tabs.length - 1; i >= 0; i--) {
                const t = tabs[i];
                if (t.style.transform && t !== tab) {
                    currentTabContainer.insertBefore(tab, t.nextSibling);
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
            tab.classList.remove('dragging');
        }, 30);

        tab.removeEventListener('drag', dragHandler);

        for (let tContainer of document.querySelectorAll('.tabs-list')) {
            tContainer.removeEventListener('dragenter', tabDragEnterHandler);
            tContainer.removeEventListener('dragover', dragOverHandler);
        }
    }


    // Handles the dropping of tabs
    function dropHandler(e) {
        e.preventDefault();

        const target = e.target;
        if (!target.classList.contains('window-highlight')) return;
        target.classList.remove('highlight-display');
        
        const panel = target.closest('.panel-container');
        if (target.classList.contains('window-highlight') && !target.classList.contains('highlight-center')) {
            const direction = target.classList[1].split('-')[1];

            const { panel1, panel2 } = this.splitPanel(direction, panel);
            moveTab(tab, panel2);

            const tabContainer = panel.querySelector('.tabs-list');
            const contentContainer = panel.querySelector('.window-container');

            panel1.appendChild(tabContainer);
            panel1.appendChild(contentContainer);
        } else if (!panel.contains(tab)) {
            moveTab(tab, target.closest('.panel-container'));
        }

    }


    // Handles moving tabs between panels
    function tabDragEnterHandler(e) {
        e.preventDefault();

        const tabContainer = e.target.closest('.tabs-list');
        if (tabContainer === currentTabContainer) return;

        const oldContainer = tab.parentElement;
        requestAnimationFrame(() => {
            tab.style.transform = '';
            const rect = tab.getBoundingClientRect();
            left = rect.left;
            right = rect.right;
        });

        oldContainer.querySelectorAll('.tab').forEach((t) => {
            t.style.transform = ''; // Reset the transform for all tabs in the old container
        });
        moveTab(tab, tabContainer.parentElement);

        console.log(tabContainer);
        currentTabContainer = tabContainer;
    }


    tab.addEventListener('drag', dragHandler);
    tab.addEventListener('dragend', dragEndHandler, { once: true });
    document.addEventListener('drop', dropHandler.bind(this), { once: true });

    for (let tContainer of document.querySelectorAll('.tabs-list')) {
        tContainer.addEventListener('dragenter', tabDragEnterHandler);
        tContainer.addEventListener('dragover', dragOverHandler);
    }

}


// --------------------------------------------------------------------------------------
//                      Content event handler functions
// --------------------------------------------------------------------------------------

async function displayPDF(path, page, table) {
    var pdf = document.getElementById(path);
    if (!pdf) {
        // Get the PDF blob
        var blob = this.panel.documents[path];
        // First PDF reference, download it from dropbox
        if ( !blob ) {
            const file = await this.panel.dbx.dbx.filesDownload({path: `/wip_lo/codes/${path}`});
            blob = file.result.fileBlob;
            this.panel.documents[path] = blob;
        }
        // Create a new tab with the PDF
        const tab = await this.panel.addTab(this.panel.tabIdx++, 'pdf', URL.createObjectURL(blob), path);
        const panel = this.panel.layoutContainer.firstChild;
        // If the top panel is split, place the PDF in the right/bottom most panel
        if ( panel.classList.contains('split-row') || panel.classList.contains('split-column') )
        {
            tab.appendContainer(panel.lastChild);
            tab.changeTab();
        // Else split the panel to the right and place the PDF there
        } else {
            const { panel1, panel2 } = this.panel.splitPanel('right', panel);
            tab.appendContainer(panel2);
            tab.changeTab();

            const tabsList = panel.querySelector('.tabs-list');
            const contents = panel.querySelector('.window-container');

            panel1.appendChild(tabsList);
            panel1.appendChild(contents);
        }

        pdf = document.getElementById(path);
    }
    const pdfParent = pdf.parentElement;
    const idx = Array.from(pdfParent.children).indexOf(pdf);

    // Attach the pdf to the DOM such that the page number can be changed
    table.title.appendChild(pdf);
    pdf.src = pdf.src.split('#')[0] + `#page=${page}`;

    // Move the pdf back to its original position
    pdfParent.insertBefore(pdf, pdfParent.children[idx]);
}


export async function chatSendHandler() {
    const msg = this.content.chatInput.value.trim();

    // Add event listeners for the PDF button if a table is created
    const table = await this.content.input(msg, this.panel);
    if (table && table.title) {
        const rows = table.div.querySelectorAll('tr');
        rows.forEach((row) => {
            row.addEventListener('click', async () => {
                const title = row.children[0].textContent;
                const page = row.children[2].textContent;
                const query = await window.database.queryTable(`select pdfPath, page from document_metadata where title = '${title}'`);
                const pdfPath = query[0].pdfPath;

                await displayPDF.call(this, pdfPath, page, table);
            });
        });


        if (table.tableID) {
            table.title.addEventListener('click', async () => {
                const query = await window.database.queryTable(`select pdfPath, page from document_metadata where tableID = '${table.tableID}'`);
                const results = query[0];
                const { pdfPath, page } = results;

                await displayPDF.call(this, pdfPath, page, table);
            });
        }
    }
}



export function settingsButtonHandler() {
    // Open settings menu

    console.log(this.settingsButton)
    const panel = this.settingsButton.closest('.panel-container')
    if (panel.querySelector('.chat-menu')) return;

    const chatMenu = document.createElement('div');
    chatMenu.classList.add('chat-menu');

    const aiModelChange = document.createElement('div')
    aiModelChange.textContent = 'Change AI model';
    aiModelChange.classList.add('chat-submenu');


    const embedDepth = document.createElement('div')
    embedDepth.textContent = 'Set embedding depth';
    embedDepth.classList.add('chat-submenu');

    panel.appendChild(chatMenu);
    chatMenu.appendChild(aiModelChange);
    chatMenu.appendChild(embedDepth);


    function closeChatMenu(e) {
        e.preventDefault();
        if (!chatMenu.contains(e.target) && !e.target.classList.contains('chat-settings')) {
            chatMenu.remove();
            document.removeEventListener('click', closeChatMenu);
        }
    }

    document.addEventListener('click', closeChatMenu);
}


// --------------------------------------------------------------------------------------
//                      Window highlight handler functions
// --------------------------------------------------------------------------------------

function handleDragenter(e) {
    e.preventDefault(); // Prevent default dragover behavior

    e.target.classList.add('highlight-display'); // Add a class to indicate the dragenter event
}

function handleDragleave(e) {
    e.preventDefault(); // Prevent default dragleave behavior

    e.target.classList.remove('highlight-display'); // Remove the class indicating the dragenter event
}

export function dragEnterHandler(e) {
    e.preventDefault();
    e.stopPropagation();

    const windowsHighlights = document.getElementsByClassName('window-highlight');
    [...windowsHighlights].forEach((windowsHighlight) => {
        windowsHighlight.style.pointerEvents = 'auto'; // Enable pointer events on window highlights
        [...windowsHighlight.children].forEach((div) => {
            div.addEventListener('dragenter', handleDragenter);
            div.addEventListener('dragleave', handleDragleave); // Handle drag leave on window containers
        })
    })
}

export function dragEndHandler(e) {
    e.preventDefault();
    e.stopPropagation();

    const windowsHighlights = document.getElementsByClassName('window-highlight');
    [...windowsHighlights].forEach((windowsHighlight) => {
        windowsHighlight.style.pointerEvents = 'none'; // Disable pointer events on window highlights
        [...windowsHighlight.children].forEach((div) => {
            div.removeEventListener('dragenter', handleDragenter);
            div.removeEventListener('dragleave', handleDragleave); // Remove drag leave event listener
        })
    });
}