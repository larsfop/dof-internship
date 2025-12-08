import { newTab } from "../tab.js";
import { newHTMLElement, toggleHidden, getOtherElementByID } from "../utils/html-helper-functions.js";

export async function loadHistory() {
    const response = await fetch('http://localhost:8015/get_sessions', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionStorage.getItem('access_token')}`
        }
    });
    const data = await response.json();
    console.log(data);
    for (const session of data) {
        addHistoryEntry(session.sessionID, session.name);
    }
}


export function addHistoryEntry(sessionID, sessionName) {
    let entryContainer = document.getElementById(`history:${sessionID}`);
    if (!entryContainer) {
        entryContainer = newHTMLElement('div', null, {
            className: 'history-entry-container',
            id: `history:${sessionID}`,
        });

        newHTMLElement('span', entryContainer, {
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

    const historyDiv = document.getElementById('chat-history');
    historyDiv.insertBefore(entryContainer, historyDiv.children[1]);
}


async function onClickHandler(sessionID, sessionName) {
    const chatDiv = document.getElementById(`content:${sessionID}`);
    if (chatDiv) {
        const tabDiv = document.getElementById(`tab:${sessionID}`);
        tabDiv.click();
    } else {
        const response = await fetch(`http://localhost:8015/get_chat?session_id=${sessionID}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem('access_token')}`
            }
        });
        const data = await response.json();
        const panel = document.querySelector('.panel-container.last-active');
        newTab(panel, 'chatbot', data, sessionID, sessionName);
    }
}


async function removeHistoryEntry(sessionID) {
    const entryDiv = document.getElementById(`history:${sessionID}`);
    if (entryDiv) {
        entryDiv.remove();

        await fetch(`http://localhost:8015/remove_session?session_id=${sessionID}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem('access_token')}`
            }
        });
    }
}
