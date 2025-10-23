// --------------------------------------------------------------------------------------
//                          Tab event handler functions
// --------------------------------------------------------------------------------------

// Toggle a tab active or inactive, can be forced for better control
function toggleActive(tab, force = null) {
    const index = tab.dataset.index;
    const content = document.querySelector(`.chat-container[data-index="${index}"], .pdf-viewer[data-index="${index}"]`);

    const active = tab.classList.toggle('active', force);
    if (active) {
        content.style.display = 'block';
            // insert new active content as first child
            // The order of the content elements is used for active tab memory
        content.parentElement.insertBefore(content, content.parentElement.firstChild);
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
    const oldContainer = tab.parentElement;

    const tabContainer = panel.querySelector('.tabs-list');
    const contentContainer = panel.querySelector('.window-container');

    tabContainer.insertBefore(tab, tabContainer.lastChild);
    contentContainer.insertBefore(content, contentContainer.firstChild);

    changeTab(tab);
    
    // Toggle previously active tab
    const oldIndex = oldContainer.nextSibling.firstChild.dataset.index;
    const oldTab = oldContainer.querySelector(`.tab[data-index="${oldIndex}"]`);
    if (oldTab) {
        toggleActive(oldTab, true);
    }
}


function removePanel(panel) {
    const parent = panel.parentNode; // Get the parent container of the panel
    if (parent.classList.contains('layout-container')) {
        // If the panel is the only one in the layout, remove it
        parent.removeChild(panel);
    }
    else if (parent.classList.contains('split-row') || parent.classList.contains('split-column')) {
        // Remove splitter
        if (parent.firstChild === panel) {
            parent.removeChild(panel.nextSibling);
        } else {
            parent.removeChild(panel.previousSibling);
        }

        panel.remove(); // Remove the panel
    }

    if (parent.getElementsByClassName('panel-container').length === 1) {
        // If one panel remains, move the panel up one level
        const child = parent.firstChild; // Get the first child of the parent
        const parentParent = parent.parentNode; // Get the parent of the parent
        child.style.margin = '0'; // Reset margin
        child.style.border = 'none'; // Reset border
        child.style.width = '100%'; // Reset width to full
        child.style.height = '100%'; // Reset height to full

        if (parentParent.firstChild === parent) {
            parentParent.insertBefore(child, parent); // Insert the child before the parent
            if (parentParent.classList.contains('split-row')) {
                child.style.marginRight = '-8px'; // Adjust margin for row split
                child.style.borderRight = '4px solid gray'; // Add a border to the right side
            } else if (parentParent.classList.contains('split-column')) {
                child.style.marginBottom = '-8px'; // Adjust margin for column split
                child.style.borderBottom = '4px solid gray'; // Add a border to the bottom side
            }
        } else {
            parent.parentNode.appendChild(child);   
        }

        parent.remove(); // Remove the empty parent container
    }
}


// Tab visual movement handler
export function tabListEventHandler(e) {
    const tab = e.target.closest('.tab');
    const tabsList = tab.parentElement;
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

        // Remove empty panels
        const panels = document.querySelectorAll('.panel-container');
        for (let panel of panels) {
            const tabsList = panel.querySelector('.tabs-list');
            if (tabsList.children.length === 1) {
                removePanel(panel);
            }
        }
    }


    // Handles the dropping of tabs
    function dropHandler(e) {
        e.preventDefault();
        const tabsList = tab.parentElement;

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

        if (tabsList.children.length === 1) {
            const panel = tabsList.parentElement;
            removePanel(panel);
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

        // Toggle previously active tab
        // const index = oldContainer.nextSibling.firstChild.dataset.index;
        // toggleActive(oldContainer.querySelector(`.tab[data-index="${index}"]`), true);

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

export async function displayPDF(name, page, layout, div) {
    var pdf = document.getElementById(name);
    if (!pdf) {
        // Get the PDF blob
        const pdfResponse = await fetch(`http://localhost:8015/pdf?name=${name}.pdf`);
        const pdfBlob = await pdfResponse.blob();
        const pdfUrl = URL.createObjectURL(pdfBlob);

        const tab = await layout.addTab(layout.tabIdx++, 'pdf', pdfUrl, name);
        const panel = layout.layoutContainer.firstChild;
        // If the top panel is split, place the PDF in the right/bottom most panel
        if ( panel.classList.contains('split-row') || panel.classList.contains('split-column') )
        {
            tab.appendContainer(panel.lastChild);
        // Else split the panel to the right and place the PDF there
        } else {
            const { panel1, panel2 } = layout.splitPanel('right', panel);
            tab.appendContainer(panel2);

            const tabsList = panel.querySelector('.tabs-list');
            const contents = panel.querySelector('.window-container');

            panel1.appendChild(tabsList);
            panel1.appendChild(contents);
        }

        // URL.revokeObjectURL(pdfUrl);
        pdf = document.getElementById(name);
    }
    const pdfParent = pdf.parentElement;
    const idx = Array.from(pdfParent.children).indexOf(pdf);
    const tab = document.querySelector(`.tab[data-index="${pdf.dataset.index}"]`);

    // Attach the pdf to the DOM temporarily to change page
    div.appendChild(pdf);
    pdf.src = pdf.src.split('#')[0] + `#page=${page}`;

    // Move the pdf back to its original position
    pdfParent.insertBefore(pdf, pdfParent.children[idx]);
    changeTab(tab);
}


export function settingsButtonHandler() {
    // Open settings menu
    const self = this;

    const panel = self.settingsButton.closest('.panel-container')
    if (panel.querySelector('.chat-menu')) return;

    const chatMenu = document.createElement('div');
    chatMenu.classList.add('chat-menu');
    panel.appendChild(chatMenu);

    const aiModelChange = document.createElement('div')
    chatMenu.appendChild(aiModelChange);

    aiModelChange.textContent = 'Change AI model';
    aiModelChange.classList.add('chat-submenu');

    let modelSubMenuExists = false;
    aiModelChange.addEventListener('mouseenter', () => {
        if (modelSubMenuExists) return;
        modelSubMenuExists = true;

        const hoverMenu = document.createElement('div');
        panel.appendChild(hoverMenu);
        hoverMenu.classList.add('hover-menu');

        const models = ['gpt-4.1', 'o4-mini', 'gpt-5.1'];
        for (let model of models) {
            const option = document.createElement('li');
            option.classList.add('chat-submenu');
            option.textContent = model;

            option.onclick = () => {
                self.model = model;
            };

            hoverMenu.appendChild(option);
        }

        const { right, top, height } = aiModelChange.getBoundingClientRect();
        hoverMenu.style.transform = `translate(${right}px, ${top + height - hoverMenu.offsetHeight}px)`;

        function handleMouseLeave(e) {
            if (!hoverMenu.contains(e.relatedTarget) && e.relatedTarget !== aiModelChange) {
                hoverMenu.remove();
                modelSubMenuExists = false;

                hoverMenu.removeEventListener('mouseleave', handleMouseLeave);
                aiModelChange.removeEventListener('mouseleave', handleMouseLeave);
            }
        }

        hoverMenu.addEventListener('mouseleave', handleMouseLeave);
        aiModelChange.addEventListener('mouseleave', handleMouseLeave);
    });


    const embedDepth = document.createElement('div');
    chatMenu.appendChild(embedDepth);

    function scroll(e) {
        e.preventDefault(); // Prevent page scroll
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
        self.embedDepth = value;
    }

    embedDepth.textContent = 'Set embedding depth';
    embedDepth.classList.add('chat-submenu');
    let embedSubMenuExists = false;
    let i = 0;
    embedDepth.addEventListener('mouseenter', () => {
        if (embedSubMenuExists) return;
        embedSubMenuExists = true;

        const option = document.createElement('input');
        option.id = `${i++}`;
        option.type = 'number';
        option.min = 0;
        option.max = 100;
        option.value = self.embedDepth;
        option.classList.add('hover-menu');
        panel.appendChild(option);

        option.addEventListener('wheel', scroll);

        const { right, top, height } = embedDepth.getBoundingClientRect();
        option.style.transform = `translate(${right}px, ${top + height - option.offsetHeight}px)`;

        function handleMouseLeave(e) {
            if (!option.contains(e.relatedTarget) && e.relatedTarget !== embedDepth) {
                option.remove();
                embedSubMenuExists = false;

                option.removeEventListener('mouseleave', handleMouseLeave);
                embedDepth.removeEventListener('mouseleave', handleMouseLeave);
            }
        }

        option.addEventListener('mouseleave', handleMouseLeave);
        embedDepth.addEventListener('mouseleave', handleMouseLeave);
    });

    const conversation = document.createElement('div');
    chatMenu.appendChild(conversation);
    conversation.classList.add('chat-submenu');
    conversation.textContent = 'Conversation';

    let conversationSubMenuExists = false;
    let conversationChecked;
    if (self.conversationCheckBox) {
        conversationChecked = self.conversation;
    } else {
        conversationChecked = true;
    }
    conversation.addEventListener('mouseenter', () => {
        if (conversationSubMenuExists) return;
        conversationSubMenuExists = true;

        const wrapper = document.createElement('div');
        wrapper.classList.add('hover-menu');
        panel.appendChild(wrapper);

        self.conversationCheckBox = document.createElement('input');
        self.conversationCheckBox.type = 'checkbox';
        self.conversationCheckBox.id = 'conversation';
        self.conversationCheckBox.value = 'conversation';
        self.conversationCheckBox.name = 'conversation';
        self.conversationCheckBox.checked = conversationChecked;
        wrapper.appendChild(self.conversationCheckBox);

        const label = document.createElement('label');
        label.textContent = 'Use conversation';
        label.htmlFor = self.conversationCheckBox.id;
        wrapper.appendChild(label);

        const { right, top, height } = conversation.getBoundingClientRect();
        wrapper.style.transform = `translate(${right}px, ${top + height - wrapper.offsetHeight}px)`;

        function handleMouseLeave(e) {
            if (!wrapper.contains(e.relatedTarget) && e.relatedTarget !== conversation) {
                wrapper.remove();
                conversationSubMenuExists = false;

                wrapper.removeEventListener('mouseleave', handleMouseLeave);
                conversation.removeEventListener('mouseleave', handleMouseLeave);
            }
        }

        wrapper.addEventListener('mouseleave', handleMouseLeave);
        conversation.addEventListener('mouseleave', handleMouseLeave);


    });

    function closeChatMenu(e) {
        e.preventDefault();
        if (
            !chatMenu.contains(e.target) && 
            e.target !== self.settingsButton &&
            !e.target.closest('.hover-menu')
        ) {
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