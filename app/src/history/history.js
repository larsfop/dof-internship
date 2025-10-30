export class HistoryMenu {
    constructor(layout) {
        this.layout = layout;
    }

    createUI(div) {
        this.historyDiv = document.createElement('details');
        this.historyDiv.id = 'history-menu';
        this.historyDiv.className = 'history-menu';
        this.historyDiv.setAttribute('inert', '');
        div.appendChild(this.historyDiv);

        // Hide scrollbar until details fully opened
        this.historyDiv.addEventListener('transitionend', (e) => {
            if (e.propertyName === 'height') {
                // Check that the details is still open after transition
                if (this.historyDiv.hasAttribute('open')) {
                    this.historyDiv.classList.add('opened');
                } else {
                    this.historyDiv.classList.remove('opened');
                }
            }
        })

        const summary = document.createElement('summary');
        summary.className = 'history-summary';
        summary.textContent = 'History';
        this.historyDiv.appendChild(summary);
    }

    toggleExpand() {
        const isExpanded = this.historyDiv.classList.toggle('expanded');
        if (isExpanded) {
            this.historyDiv.removeAttribute('inert');
        } else {
            this.historyDiv.setAttribute('inert', '');
        }
    }

    addEntry(sessionID) {
        let entryDiv = document.getElementById(`history-${sessionID}`);
        if (!entryDiv) {
            entryDiv = document.createElement('div');
            entryDiv.className = 'history-entry';
            entryDiv.id = `history-${sessionID}`;
            entryDiv.textContent = sessionID;

            entryDiv.onclick = this.onClickHandler.bind(this, sessionID);
        }

        this.historyDiv.insertBefore(entryDiv, this.historyDiv.firstChild.nextSibling);
    }

    async loadHistory() {
        const data = await window.app.history.read('history/history-index.json');

        for (let i = data.length - 1; i >= 0; i--) {
            this.addEntry(data[i].sessionID);
        }
    }

    async onClickHandler(sessionID) {
        const chatDiv = document.getElementById(`chatbox-${sessionID}`);
        if (chatDiv) {
            const index = chatDiv.dataset.index;
            const tabDiv = document.querySelector(`.tab[data-index="${index}"]`);
            changeTab(tabDiv);
        } else {
            const data = await window.app.history.read(`history/chats/${sessionID}.json`);
            const panel = document.querySelector('.panel-container');
            const tab = this.layout.addTab(this.layout.tabIdx++, 'chatbox', sessionID, data);
            tab.appendContainer(panel);
            tab.changeTab(); // Change to the newly created tab
        }
        this.addEntry(sessionID);
    }
}


function changeTab(tabDiv) {
    const parent = tabDiv.parentNode; // Get the parent container of the tab
    const activeTab = parent.getElementsByClassName('active')[0]; // Get the active tab
    if (activeTab) {
        if (activeTab !== tabDiv) {
            toggleActive(activeTab, false); // Deactivate the currently active tab
        }
    }
    toggleActive(tabDiv, true); // Activate the clicked tab
}


function toggleActive(tabDiv, force = null) {
    const index = tabDiv.dataset.index;
    const content = document.querySelector(`.chat-container[data-index="${index}"], .pdf-viewer[data-index="${index}"]`);

    const active = tabDiv.classList.toggle('active', force); // Toggle the active class for the tab
    if (active) {
        content.style.display = 'block';
    } else {
        content.style.display = 'none';
    }
}