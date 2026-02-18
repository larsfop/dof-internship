import { newTab } from "../tab.js";
import { newHTMLElement, toggleHidden, getOtherElementByID } from "../utils/html-helper-functions.js";

export async function loadHistory() {
    const response = await fetch('http://192.168.0.71:8015/get_sessions', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionStorage.getItem('access_token')}`
        }
    });
    const data = await response.json();
    console.log(data);
    for (const session of data) {
        addHistoryEntry(session.sessionid, session.name);
    }
}


export function addHistoryEntry(sessionID, sessionName) {
    let entryContainer = document.getElementById(`history:${sessionID}`);
    if (!entryContainer) {
        entryContainer = newHTMLElement('div', null, {
            className: 'history-entry-container',
            id: `history:${sessionID}`,
            // dataset: {
            //     tooltip: sessionName
            // }
        });

        const historyEntry = newHTMLElement('span', entryContainer, {
            className: 'history-entry',
            textContent: sessionName,
            onclick: function() {
                onClickHandler(sessionID, sessionName);
            }
        });

        const menuContainerButton = newHTMLElement('div', entryContainer, {
            className: 'history-entry-container-menu-button',
            'textContent': '⋯',
        });

        const menuContainer = newHTMLElement('div', entryContainer, {
            className: 'history-entry-container-menu hidden',
            inert: true,
        });

        menuContainerButton.onclick = function(e) {
            e.stopPropagation();
            const historyMenus = Array.from(document.querySelectorAll('.history-entry-container-menu'));
            for (const menu of historyMenus) {
                console.log(menu);
            }
            toggleHidden(menuContainer, false);
        }

        newHTMLElement('span', menuContainer, {
            className: 'history-entry-container-menu-option',
            textContent: 'Rename',
            onclick: function(e) {
                e.stopPropagation();
                toggleHidden(menuContainer, true);
                const input = newHTMLElement('input', null, {
                    type: 'text',
                    value: sessionName,
                    className: 'history-entry',
                });

                historyEntry.replaceWith(input);

                input.focus();
                input.select();

                async function updateName() {
                    const newName = input.value.trim();
                    if (newName && newName !== sessionName) {
                        sessionName = newName;
                        historyEntry.textContent = sessionName;
                        input.replaceWith(historyEntry);
                        fetch(`http://192.168.0.71:8015/update_session_name?session_id=${sessionID}&new_name=${encodeURIComponent(sessionName)}`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${sessionStorage.getItem('access_token')}`
                            }
                        });
                    } else {
                        input.replaceWith(historyEntry);
                    }
                }

                input.onblur = updateName;
                input.onkeydown = function(e) {
                    if (e.key === 'Enter') {
                        updateName();
                    } else if (e.key === 'Escape') {
                        input.replaceWith(historyEntry);
                    }
                }
            }
        })

        newHTMLElement('br', menuContainer);

        newHTMLElement('span', menuContainer, {
            className: 'history-entry-container-menu-option',
            textContent: 'Delete',
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
        const response = await fetch(`http://192.168.0.71:8015/get_chat?session_id=${sessionID}`, {
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
    console.log('Removing session:', sessionID);
    if (entryDiv) {
        entryDiv.remove();

        await fetch(`http://192.168.0.71:8015/remove_session?session_id=${sessionID}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem('access_token')}`
            },
        });
    }
}


async function updateName(sessionID, newName) {

}
