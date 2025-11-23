import { displayPDF } from "./event-handlers.js";
import { newHTMLElement, toggleHidden, scrollInputHandler, getOtherElementByID } from "./utils/html-helper-functions.js";
import { addHistoryEntry } from "./history/history.js";

const documentReferences = {
    'EN1992': 'ns-en-1992-1-1_2004+a1_2014+na_2024_en_002.pdf',
    'EN1995': 'ns-en-1995-1-1_2004+a2_2014+na_2024_en_001.pdf'
}


/**
 * Sets up the content area based on the specified type.
 * @param {HTMLElement} parentDiv - The parent div to contain the content.
 * @param {string} type - The type of content ('chatbot' or 'pdf').
 * @param {any} data - The data to initialize the content with. Either chat history or PDF path.
 * @param {string|null} sessionID - Optional session ID for the content.
 * @param {string|null} sessionName - Optional session name for the content.
 */
export function setupContent(parentDiv, type = 'chatbot', data = null, sessionID = null, sessionName = null) {
    const id = sessionID || crypto.randomUUID();

    if (type === 'chatbot') {
        const content = newHTMLElement('div', parentDiv, {
            className: 'chat-container',
            id: `content:${id}`,
            dataset: {
                name: sessionName || '',
                embedDepth: '0',
                model: 'o4-mini',
                historyIndex: '-1'
            }
        });
        setupChatbot(content, data);
    } else if (type === 'pdf') {
        setupPDFViewer(parentDiv, data, id, sessionName);
    }
}


function setupPDFViewer(parentDiv, pdfPath, sessionID = null, sessionName = null) {
    const viewer = `./pdfjs/web/viewer.html?file=${encodeURIComponent(pdfPath)}`; // Path to the PDF.js viewer

    const content = newHTMLElement('embed', parentDiv, {
        className: 'pdf-viewer',
        id: `content:${sessionID}`,
        src: viewer,
        width: '100%',
        height: '100%',
        dataset: {
            name: sessionName || ''
        }
    });

    content.addEventListener('webviewerloaded', function() {
        const originalResize = window.webViewerResize;
        let resizeTimeout;

        window.webViewerResize = function () {
            clearTimeout(resizeTimeout);

            // Run the resize logic ONLY after resizing stops
            resizeTimeout = setTimeout(() => {
            originalResize();
            }, 250); // adjust delay as needed
        };
    });
}


function loadHistory(chatMessages, history) {
    for (const { input, output, metadata } of history) {
        if (chatMessages.children.length > 0) {
            newHTMLElement('hr', chatMessages);
        }

        const contentBlock = newHTMLElement('div', chatMessages, {
            className: 'content-block'
        });

        // Display input message
        newHTMLElement('p', contentBlock, {
            className: 'input-message',
            innerHTML: input
        });

        // Display output message
        const outputDiv = newHTMLElement('div', contentBlock, {
            className: 'output-message',
            innerHTML: output
        });

        // const references = outputDiv.getElementsByTagName('cite');
        // for (const ref of references) {
        //     onReferenceClick(ref, metadata.pageCorrections);
        // }
    }
}


function setupChatbot(content, history) {
    const chatMessages = newHTMLElement('div', content, {
        className: 'chat-messages'
    });
    if (history) {
        loadHistory(chatMessages, history);
    }

    const chat = newHTMLElement('div', content, {
        className: 'chat'
    });
    
    const chatMenuContainer = newHTMLElement('div', content, {
        className: 'chat-menu-container'
    });

    const chatSettings = newHTMLElement('div', chatMenuContainer, {
        className: 'chat-menu hidden',
        inert: true
    }, {
        transform: 'translate(24px, -68px)'
    });

    const settingsButton = newHTMLElement('button', chat, {
        className: 'chat-settings',
        innerText: '+',
        onclick: function() {
            const chatMenus = Array.from(document.getElementsByClassName('chat-menu-container'));
            for (const menu of chatMenus) {
                const children = menu.children;
                for (const child of children) {
                    toggleHidden(child, true);
                }
            }
            toggleHidden(chatSettings, false);
        }
    });

    const chatInput = newHTMLElement('input', chat, {
        className: 'chat-input',
        type: 'text',
        placeholder: 'Type your message here...'
    });

    const chatSend = newHTMLElement('button', chat, {
        className: 'chat-send',
        innerText: 'Send',
        onclick: function() {
            const msg = chatInput.value.trim();
            chatInput.value = '';
            if (msg) {
                userInput(content, msg);
            }
        }
    });

    const embedDepthInput = newHTMLElement('input', null, {
        type: 'number',
        min: '0',
        value: parseInt(content.dataset.embedDepth),
        onchange: function(e) {
            content.dataset.embedDepth = parseInt(e.target.value);
        }
    });
    embedDepthInput.addEventListener('wheel', function(e) {
        const newValue = scrollInputHandler(e, this);
        content.dataset.embedDepth = newValue;
    });
    embedDepthInput.addEventListener('input', function(e) {
        content.dataset.embedDepth = Number(this.value);
    });
    addChatMenuItem(chatSettings, chatMenuContainer, 'Embed Depth:', 166, -70, [embedDepthInput]);

    const aiModelItems = createAIModelItems(content);
    addChatMenuItem(chatSettings, chatMenuContainer, 'AI Model:', 166, -70, aiModelItems);

    chatInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            chatSend.click();
        }
    });

    content.addEventListener('keydown', function(e) {
        chatHistoryNavigation(e, content);
    });
}


function createAIModelItems(content) {
    const models = ['o4-mini', 'gpt-4.1', 'gpt-5', 'gpt-5-mini']
    const items = [];
    for (const model of models) {
        const div = newHTMLElement('div', null, {
            className: 'ai-model-item'
        });
        const modelItem = newHTMLElement('input', div, {
            type: 'radio',
            name: 'ai-model',
            className: 'ai-model-radio',
            id: model,
            checked: content.dataset.model === model
        });
        newHTMLElement('label', div, {
            for: model,
            innerText: model,
            className: 'ai-model-label'
        });

        div.onclick = function() {
            content.dataset.model = model;
            console.log(`AI model set to ${model}`);
            modelItem.checked = true;
        };

        items.push(div);
    }
    return items;
}


function addChatMenuItem(chatSettings, chatMenuContainer, labelText, x, y, menuItems) {
    const label = newHTMLElement('label', chatSettings, {
        innerText: labelText,
        className: 'chat-menu-item'
    });

    const subMenu = newHTMLElement('div', chatMenuContainer, {
        className: 'chat-submenu hidden',
        inert: true
    }, {
        transform: `translate(${x}px, ${y}px)`
    });

    for (const item of menuItems) {
        subMenu.appendChild(item);
    }

    label.addEventListener('mouseenter', function() {
        menuItemMouseEnterHandler(subMenu);
    });
}


function menuItemMouseEnterHandler(subMenu) {
    const subMenus = document.getElementsByClassName('chat-submenu');
    for (const menu of subMenus) {
        toggleHidden(menu, true);
    }

    toggleHidden(subMenu, false);
}


async function userInput(content, message) {
    if (!message) return;

    const chatMessages = content.querySelector('.chat-messages');
    chatMessages.scrollTop = chatMessages.scrollHeight;

    if (chatMessages.children.length > 0) {
        newHTMLElement('hr', chatMessages);
    }
    const contentBlock = newHTMLElement('div', chatMessages, {
        className: 'content-block'
    });


    // Display input message
    newHTMLElement('p', contentBlock, {
        innerText: message,
        className: 'input-message'
    });

    await chatResponse(content, contentBlock, message);

    chatMessages.scrollTop = chatMessages.scrollHeight;
}


async function chatResponse(content, contentBlock, message) {
    const embedDepth = parseInt(content.dataset.embedDepth)
    const model = content.dataset.model
    const sessionID = content.id.replace('content:', '');
    var sessionName = content.dataset.name;

    const queryParams = new URLSearchParams({
            prompt: message,
            embed_depth: embedDepth,
            model: model,
            user_id: localStorage.getItem('userID'),
            session_id: sessionID,
            session_name: sessionName,
            entry_id: crypto.randomUUID(),
        })

    const chatMessages = content.querySelector('.chat-messages');
    const msgDiv = newHTMLElement('div', contentBlock, {
        className: 'output-message'
    });

    let modelCreated = false;
    const waitingLoop = async function() {
        let i = 0;
        while (!modelCreated) {
            msgDiv.innerHTML = `Processing prompt ${".".repeat(i++ % 3 + 1)}`;
            await new Promise(resolve => setTimeout(resolve, 400));
        }
    }
    waitingLoop();

    const response = await fetch(`http://localhost:8015/query?${queryParams.toString()}`);
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    let buffer = '';
    let htmlBuffer = '';
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const event = buffer.split('\n');
        buffer = event.pop(); // Keep the last partial event in the buffer

        for (const evt of event) {
            if (evt.trim()) {
                try {
                    const data = JSON.parse(evt);
                    if (data.event === 'on_chat_model_start') {
                        console.log('Response started:', data);

                        // Creating session name if not set
                        if (!content.dataset.name) {
                            sessionName = data.session_name
                            content.dataset.name = sessionName;
                            const tab = getOtherElementByID(content);
                            tab.dataset.name = sessionName;
                            tab.firstChild.textContent = sessionName;
                        }
                    } else if (data.event === 'on_chat_model_stream') {
                        modelCreated = true;
                        const contentData = data.content;
                        if (!contentData.trim()) continue;

                        htmlBuffer += contentData;
                        msgDiv.innerHTML = htmlBuffer;
                        chatMessages.scrollTop = chatMessages.scrollHeight;
                    } else if (data.event === 'on_chat_model_end') {
                        console.log('Response complete:', data);
                        const pageCorrections = data.page_corrections

                        const references = msgDiv.getElementsByTagName('cite');
                        for (const ref of references) {
                            onReferenceClick(ref, pageCorrections);
                        }
                    }
                } catch (err) {
                    console.error('Failed to parse event:', err);
                }
            }
        }
    }

    // Update chat history UI
    addHistoryEntry(sessionID, sessionName);
}


function chatHistoryNavigation(e, content) {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const chatInput = content.querySelector('.chat-input');
        const inputMessages = Array.from(content.querySelectorAll('.input-message')).reverse();
        const nInputs = inputMessages.length;
        const msg = chatInput.value.trim();
        
        const delta = e.key === 'ArrowUp' ? 1 : -1;
        let index = parseInt(content.dataset.historyIndex) + delta;
        while (index > -2 && index < nInputs) {
            const input = inputMessages[index];

            if (index === -1) {
                chatInput.value = '';
                content.dataset.historyIndex = index;
                break;
            } else if (input.innerText != msg) {
                chatInput.value = input.innerText;
                content.dataset.historyIndex = index;
                break;
            }

            index += delta;
        }

        setTimeout(() => chatInput.setSelectionRange(chatInput.value.length, chatInput.value.length), 0);
    }
}


function onReferenceClick(ref, pageCorrections) {
    const str = ref.textContent;
    const name = str.match(/EN.\d+/g)[0].replace(' ', '');
    const pageLabel = str.match(/page*.\d+/g)[0].match(/\d+/g)[0];

    const document = documentReferences[name];
    const page = pageCorrections[document][pageLabel];

    ref.onclick = async (e) => {
        e.stopPropagation();
        await displayPDF(document, page, ref);
    }
}