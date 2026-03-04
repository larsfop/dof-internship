import { newHTMLElement, toggleHidden } from './utils/html-helper-functions.js';
import { addHistoryEntry } from './history/history.js';
import { displayPDF } from './event-handlers.js';

const chatInput = document.getElementById('chat-input');
const button = document.getElementById('chat-input-button');
const chatMessagesContainer = document.getElementById('chat-messages-container');
const chatMessages = document.getElementById('chat-messages');
const chatbotContainer = document.getElementById('chatbot-container');

const scrollTopButton = document.getElementById('scroll-top');
const scrollBottomButton = document.getElementById('scroll-bottom');

chatMessagesContainer.addEventListener('scroll', function() {
    if (this.scrollTop === 0) {
        toggleHidden(scrollTopButton, true);
    } else {
        toggleHidden(scrollTopButton, false);
    }
    if (this.clientHeight + this.scrollTop >= this.scrollHeight) {
        toggleHidden(scrollBottomButton, true);
    } else {
        toggleHidden(scrollBottomButton, false);
    }
});

scrollTopButton.onclick = function() {
    chatMessagesContainer.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

scrollBottomButton.onclick = function() {
    chatMessagesContainer.scrollTo({
        top: chatMessagesContainer.scrollHeight,
        behavior: 'smooth'
    });
}

chatbotContainer.addEventListener('keydown', function(e) {
    chatHistoryNavigation(e);
});

function chatHistoryNavigation(event) {
    const chatThreads = chatMessages.firstElementChild;
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.stopPropagation();
        console.log(chatThreads)
        const inputMessages = Array.from(chatThreads.querySelectorAll('.input-message')).reverse();
        const nInputs = inputMessages.length;
        const msg = chatInput.value.trim();

        const delta = event.key === 'ArrowUp' ? 1 : -1;
        let index = parseInt(chatThreads.dataset.historyIndex) + delta;
        while (index > -2 && index < nInputs) {
            const input = inputMessages[index];

            if (index === -1) {
                chatInput.value = '';
                chatThreads.dataset.historyIndex = index;
                break;
            } else if (input.innerText != msg) {
                chatInput.value = input.innerText;
                chatThreads.dataset.historyIndex = index;
                break;
            }

            index += delta;
        }

        setTimeout(() => chatInput.setSelectionRange(chatInput.value.length, chatInput.value.length), 0);
    } else {
        chatThreads.dataset.historyIndex = -1;
    }
}

function chatInputHandler() {
    const message = chatInput.value.trim();
    chatInput.value = '';
    if (message) {
        userInput(message);
    }
}

button.onclick = chatInputHandler;  
chatInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        chatInputHandler(e);
    }
});

export function loadChatSession(sessionID, data, sessionName) {
    const chatThreads = newHTMLElement('div', null, {
        className: 'chat-threads',
        id: `chat:${sessionID}`,
        dataset: {
            name: sessionName,
            historyIndex: -1
        }
    });
    chatMessages.prepend(chatThreads);

    for (const { prompt, response, citations } of data) {
        if (chatThreads.children.length > 0) {
            newHTMLElement('hr', chatThreads);
        }

        const contentBlock = newHTMLElement('div', chatThreads, {
            className: 'content-block'
        });

        displayInput(contentBlock, prompt);

        // Display output message
        const outputDiv = newHTMLElement('div', contentBlock, {
            className: 'output-message',
            innerHTML: response
        });

        handleCitations(citations, outputDiv);

        handleCodeBlocks(outputDiv);
    }
}

async function userInput(message) {
    if (!message) return;

    const messageElement = chatMessages.firstElementChild;
    if (messageElement.id === 'new-chat') {
        messageElement.className = 'chat-threads';
        messageElement.id = `chat:${crypto.randomUUID()}`;
        messageElement.dataset.historyIndex = -1;
    }

    if (messageElement.childElementCount > 0) {
        newHTMLElement('hr', messageElement);
    }

    const contentBlock = newHTMLElement('div', messageElement, {
        className: 'content-block',
    });

    displayInput(contentBlock, message);

    chatResponse(contentBlock, message, messageElement);
}

async function chatResponse(contentBlock, message, messageContainer) {
    const sessionID = messageContainer.id.replace('chat:', '');
    const queryParams = new URLSearchParams({
        prompt: message,
        user_id: sessionStorage.getItem('userID'),
        session_id: sessionID
    })

    const responseDiv = newHTMLElement('div', contentBlock, {
        className: 'output-message'
    });

    let modelCreated = false;
    const waitingLoop = async function() {
        let i = 0;
        while (!modelCreated) {
            responseDiv.textContent = 'Waiting for response' + '.'.repeat(i++ % 3 + 1);
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    waitingLoop();

    const response =  await fetch(`http://192.168.0.71:8015/prompt?${queryParams.toString()}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionStorage.getItem('access_token')}`
        }
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');

    var data;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const event = decoder.decode(value, { stream: true });

        data = JSON.parse(event);
        var sessionName;
        if (data.node === 'semantic_cache') {
            modelCreated = true;
            console.log('Received data chunk:', data);
            responseDiv.innerHTML = data.content.response;
            sessionName = data.content.summary_title;

            handleCitations(data.content.citations, responseDiv);
            handleSessionNaming(messageContainer, sessionName);
        } else if (data.node === 'generate_answer') {
            modelCreated = true;
            console.log('Received data chunk:', data);
            responseDiv.innerHTML = data.content.response;
            sessionName = data.content.summary_title;

            handleCitations(data.content.citations, responseDiv);
            handleSessionNaming(messageContainer, sessionName);
            handleCodeBlocks(responseDiv);
        }
    }

    addHistoryEntry(sessionID, sessionName)
}



function displayInput(contentBlock, message) {
    const input = newHTMLElement('p', contentBlock, {
        className: 'input-message',
        innerHTML: message
    });
    const inputOptions = newHTMLElement('div', input, {
        className: 'input-options'
    });
    const rewriteButton = newHTMLElement('button', inputOptions, {
        className: 'content-button',
        title: 'Edit message',
    });
    newHTMLElement('img', rewriteButton, {
        src: 'assets/write.svg',
        alt: ''
    });
    const copyButton = newHTMLElement('button', inputOptions, {
        className: 'content-button',
        title: 'Copy',
        onclick: () => handleCopyToClipboard(copyButton, input)
    });
    newHTMLElement('img', copyButton, {
        src: 'assets/copy.svg',
        alt: ''
    });
}

function handleCitations(citations, msgDiv) {
    for (const citation of citations) {
        const documentName = citation.document_name;
        const cite = newHTMLElement('cite', msgDiv, {
            innerText: `${documentName} - Page(s): ${citation.page_labels.join(', ')}`,
            title: 'Open document',
            onclick: function(e) {
                e.stopPropagation();
                displayPDF(documentName, citation.pdf_page_indices[0]);
            }
        });
    }
}


function handleCodeBlocks(msgDiv) {
    const codeBlocks = msgDiv.querySelectorAll('pre');
    for (const block of codeBlocks) {
        const div = newHTMLElement('div', null, {
            className: 'code-block-container'
        })
        block.parentElement.insertBefore(div, block);
        div.appendChild(block);
        const copy = newHTMLElement('button', div, {
            className: 'content-button',
            title: 'Copy',
            onclick: () => handleCopyToClipboard(copy, block)
        });
        newHTMLElement('img', copy, {
            src: 'assets/copy.svg',
            alt: 'Copy'
        });
    }
}

function handleSessionNaming(content, sessionName) {
    // Handle session naming
    if (!content.dataset.name) {
        content.dataset.name = sessionName;
    }
}

function handleCopyToClipboard(button, content) {
    navigator.clipboard.writeText(content.innerText);
    const img = button.firstChild;
    img.src = 'assets/checkmark.svg';
    setTimeout(() => {
        img.src = 'assets/copy.svg';
    }, 2000);
}