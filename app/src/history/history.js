import { Tabs } from "../tabs.js";
import { newHTMLElement, toggleHidden } from "../utils/html-helper-functions.js";

export class HistoryMenu {
    constructor() {
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
        let entryDiv = document.getElementById(`history:${sessionID}`);
        if (!entryDiv) {
            entryDiv = document.createElement('div');
            entryDiv.className = 'history-entry';
            entryDiv.id = `history:${sessionID}`;
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
        const chatDiv = document.getElementById(`content:${sessionID}`);
        if (chatDiv) {
            const tabDiv = document.getElementById(`tab:${sessionID}`);
            tabDiv.click();
        } else {
            const data = await window.app.history.read(`history/chats/${sessionID}.json`);
            const panel = document.querySelector('.panel-container.last-active');
            console.log(panel)
            const tab = new Tabs(sessionID);
            tab.setupContent('chatbox', data);
            tab.appendContainer(panel);
            tab.changeTab(); // Change to the newly created tab
        }
        this.addEntry(sessionID);
    }

    loadLastTab() {
        const historyEntries = this.historyDiv.getElementsByClassName('history-entry');
        if (historyEntries.length < 1) return;

        for (const entry of historyEntries) {
            const sessionID = entry.id.replace('history:', '');
            const contentDiv = document.getElementById(`content:${sessionID}`);
            if (contentDiv) continue; // Skip if tab is already open
            this.onClickHandler(sessionID);
            break;
        }
    }
}