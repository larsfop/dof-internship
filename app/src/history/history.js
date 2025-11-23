import { newTab } from "../tab.js";
import { newHTMLElement, toggleHidden, getOtherElementByID } from "../utils/html-helper-functions.js";


export function setupHistoryMenu(parentDiv) {
    const historyDiv = newHTMLElement('details', parentDiv,
        { id: 'history-menu', className: 'history-menu hidden', inert: true },
    )

    // Hide scrollbar until details fully opened
    historyDiv.addEventListener('transitionend', function(e) {
        if (e.propertyName === 'height') {
            // Check that the details is still open after transition
            if (historyDiv.hasAttribute('open')) {
                historyDiv.classList.add('opened');
            } else {
                historyDiv.classList.remove('opened');
            }
        }
    })

    newHTMLElement('summary', historyDiv,
        { className: 'history-summary', textContent: 'History' },
    );

    loadHistory();

    return historyDiv;
}


async function loadHistory() {
    const userID = localStorage.getItem('userID');
    const response = await fetch(`http://localhost:8015/get_sessions?user_id=${userID}`)
    const data = await response.json();

    for (let i = data.length - 1; i >= 0; i--) {
        addHistoryEntry(data[i].sessionID, data[i].sessionName);
    }
}


export function addHistoryEntry(sessionID, sessionName) {
    let entryContainer = document.getElementById(`history:${sessionID}`);
    if (!entryContainer) {
        entryContainer = newHTMLElement('div', null, {
            className: 'history-entry-container',
            id: `history:${sessionID}`,
        });

        newHTMLElement('div', entryContainer, {
            className: 'history-entry',
            textContent: sessionName,
            onclick: function() {
                onClickHandler(sessionID, sessionName);
            }
        });

        newHTMLElement('button', entryContainer, {
            className: 'history-entry-delete-button',
            textContent: '✕',
            onclick: function(e) {
                e.stopPropagation();
                removeHistoryEntry(sessionID);
            }
        });
    }

    const historyDiv = document.getElementById('history-menu');
    historyDiv.insertBefore(entryContainer, historyDiv.firstChild);
}


async function onClickHandler(sessionID, sessionName) {
    const chatDiv = document.getElementById(`content:${sessionID}`);
    if (chatDiv) {
        const tabDiv = document.getElementById(`tab:${sessionID}`);
        tabDiv.click();
    } else {
        const response = await fetch(`http://localhost:8015/get_chat?session_id=${sessionID}`);
        const data = await response.json();
        const panel = document.querySelector('.panel-container.last-active');
        newTab(panel, 'chatbot', data, sessionID, sessionName);
    }
}


export async function removeHistoryEntry(sessionID) {
    const entryDiv = document.getElementById(`history:${sessionID}`);
    if (entryDiv) {
        entryDiv.remove();

        await fetch(`http://localhost:8015/remove_session?session_id=${sessionID}`);
    }
}
