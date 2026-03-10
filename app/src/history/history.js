import { newHTMLElement, toggleHidden } from "../utils/html-helper-functions.js";
import { loadChatSession } from "../chatbot.js";

export async function loadHistory() {
    const userID = localStorage.getItem('userID');
    const response = await fetch(`http://192.168.0.71:8015/get_sessions?user_id=${userID}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    });
    const data = await response.json();

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
        });

        const historyEntry = newHTMLElement('span', entryContainer, {
            className: 'history-entry',
            textContent: sessionName,
            title: sessionName,
            onclick: function() {
                onClickHandler(sessionID, sessionName);
            }
        });

        const menuContainerButton = newHTMLElement('button', entryContainer, {
            className: 'history-entry-container-menu-button',
            title: 'Chat session options',
        });

        newHTMLElement('img', menuContainerButton, {
            src: 'assets/hdots.svg',
            alt: 'Menu',
        });

        const menuContainer = newHTMLElement('div', entryContainer, {
            className: 'history-entry-container-menu hidden',
            inert: true,
        });

        menuContainerButton.onclick = function(e) {
            e.stopPropagation();
            const historyMenus = Array.from(document.querySelectorAll('.history-entry-container-menu'));
            for (const menu of historyMenus) {
                if (menu === menuContainer) continue;
                toggleHidden(menu, true);
            }
            toggleHidden(menuContainer, false);
        }

        newHTMLElement('span', menuContainer, {
            className: 'history-entry-container-menu-option',
            textContent: 'Rename',
            title: 'Rename chat session',
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

        newHTMLElement('hr', menuContainer);

        newHTMLElement('span', menuContainer, {
            className: 'history-entry-container-menu-option',
            textContent: 'Delete',
            title: 'Delete chat session',
            onclick: function(e) {
                e.stopPropagation();
                removeHistoryEntry(sessionID);
            }
        }, 
        {
            color: 'red',
        });
    }

    const historyDiv = document.getElementById('chat-history');
    historyDiv.insertBefore(entryContainer, historyDiv.firstChild);
}


async function onClickHandler(sessionID, sessionName) {
    const chatMessages = document.getElementById('chat-messages');
    const child = chatMessages.firstElementChild;
    if (child.id === 'new-chat') child.remove();


    const chatDiv = document.getElementById(`chat:${sessionID}`);
    if (chatDiv) {
        const parent = chatDiv.parentElement;
        parent.prepend(chatDiv);
    } else {
        const response = await fetch(`http://192.168.0.71:8015/get_chat?session_id=${sessionID}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        const data = await response.json();
        loadChatSession(sessionID, data, sessionName);
    }

    const chatMessagesContainer = document.getElementById('chat-messages-container');
    const scrollTopButton = document.getElementById('scroll-top');
    const scrollBottomButton = document.getElementById('scroll-bottom');

    toggleHidden(scrollTopButton, true);
    toggleHidden(scrollBottomButton, true);
    if (chatMessagesContainer.scrollHeight > chatMessagesContainer.clientHeight) {
        toggleHidden(scrollBottomButton, false);
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
            },
        });
    }
}