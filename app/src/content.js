import { Commands, chatHistoryNavigation } from "./commands.js";
import { displayPDF } from "./event-handlers.js";
import { newHTMLElement, toggleHidden, scrollInputHandler } from "./utils/html-helper-functions.js";

export class Chatbox {
    constructor(sessionID = null, history = null) {
        this.sessionID = sessionID || crypto.randomUUID();

        this.documents = {
            'EN1992': 'ns-en-1992-1-1_2004+a1_2014+na_2024_en_002.pdf',
            'EN1995': 'ns-en-1995-1-1_2004+a2_2014+na_2024_en_001.pdf'
        };

        this.inputHistory = [];
        this.historyIndex = -1;

        this.tabmatches = [];
        this.tabIndex = 0;
        this.lastTabPrefix = '';
        this.originalInput = '';

        this.model = 'o4-mini';
        this.embedDepth = 0;
        this.responseID = null;
        this.usePreviousResponse = false;

        this.commands = new Commands(this.chatInput);

        this.createUI();
        this.createListeners();

        // Load history if provided
        if (history) {
            this.loadHistory(history);
        }
    }

    async createListeners() {
        // ENTER key to send message
        this.chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.chatSend.click();
            }
        });

        // Chat history navigation
        this.mainContainer.addEventListener('keydown', chatHistoryNavigation.bind(this));
    }

    createUI() {
        this.mainContainer = newHTMLElement('div', null, {
            className: 'chat-container',
            id: `content:${this.sessionID}`
        });

        // create chat messages area
        this.chatMessages = newHTMLElement('div', this.mainContainer, {
            className: 'chat-messages border-color'
        });

        // create chat input area
        const div = newHTMLElement('div', this.mainContainer, {
            className: 'chat'
        });

        this.settingsButton = newHTMLElement('button', div, {
            className: 'chat-settings',
            innerText: '+'
        });

        this.chatInput = newHTMLElement('input', div, {
            className: 'chat-input',
            type: 'text',
            placeholder: 'Type your message here...'
        });

        // create send button
        this.chatSend = newHTMLElement('button', div, {
            className: 'chat-send',
            innerText: 'Send'
        });
        this.chatSend.onclick = function() {
            const msg = this.chatInput.value.trim();
            if (msg) {
                this.input(msg);
            }

        }.bind(this);

        this.createSettingsMenu();
    }

    addChatMenuItem(labelText, x, y, menuItems) {
        const label = newHTMLElement('label', this.chatSettings, {
            innerText: labelText,
            className: 'chat-menu-item'
        });

        const subMenu = newHTMLElement('div', this.chatMenuContainer, {
            className: 'chat-submenu hidden'
        }, {
            transform: `translate(${x}px, ${y}px)`
        });
        subMenu.setAttribute('inert', '');

        for (const item of menuItems) {
            subMenu.appendChild(item);
        }

        label.addEventListener('mouseenter', function() {
            this.menuItemMouseEnterHandler(subMenu);
        }.bind(this));

    }

    menuItemMouseEnterHandler(subMenu) {
        const subMenus = Array.from(document.getElementsByClassName('chat-submenu'));
        for (const menu of subMenus) {
            toggleHidden(menu, true);
        }

        toggleHidden(subMenu, false);
    }

    createSettingsMenu() {
        const self = this;
        this.chatMenuContainer = newHTMLElement('div', this.mainContainer, {
            className: 'chat-menu-container'
        });

        this.chatSettings = newHTMLElement('div', this.chatMenuContainer, {
            className: 'chat-menu hidden'
        }, {
            transform: 'translate(24px, -68px)'
        });
        this.chatSettings.setAttribute('inert', '');

        this.settingsButton.onclick = function(e) {
            const chatMenus = Array.from(document.getElementsByClassName('chat-menu-container'));
            for (const menu of chatMenus) {
                const children = Array.from(menu.children);
                for (const child of children) {
                    toggleHidden(child, true);
                }
            }

            toggleHidden(this.chatSettings, false);
        }.bind(this);

        // Embed depth setting
        const embedDepthInput = newHTMLElement('input', null, {
            type: 'number',
            min: '0',
            value: this.embedDepth
        });
        embedDepthInput.onchange = (e) => {
            this.embedDepth = parseInt(e.target.value);
        };
        embedDepthInput.addEventListener('wheel', function(e) {
            const newValue = scrollInputHandler.call(this, e);
            self.embedDepth = newValue;
        });
        embedDepthInput.addEventListener('input', function(e) {
            self.embedDepth = Number(this.value);
        });

        this.addChatMenuItem('Embed Depth:', 166, -70, [embedDepthInput]);


        // AI model setting
        const aiModelItems = this.createAIModelItems();
        this.addChatMenuItem('AI Model:', 166, -70, aiModelItems);
    }

    createAIModelItems() {
        const models = ['o4-mini', 'gpt-4.1']
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
                checked: this.model === model
            });
            newHTMLElement('label', div, {
                for: model,
                innerText: model,
                className: 'ai-model-label'
            });

            div.onclick = function() {
                this.model = model;
                console.log(`AI model set to ${model}`);
                modelItem.checked = true;
            }.bind(this);

            items.push(div);
        }
        return items;
    }

    loadHistory(history) {
        for (const { input, output, metadata } of history) {
            const inputOutputBlock = document.createElement('div');
            inputOutputBlock.className = 'input-output-block';

            if (this.chatMessages.children.length > 0) {
                const hr = document.createElement('hr');
                hr.style.width = '100%';
                this.chatMessages.appendChild(hr);
            }
            this.chatMessages.appendChild(inputOutputBlock);

            // Display input message
            const inputDiv = document.createElement('p');
            inputDiv.className = 'input-message';
            inputDiv.innerHTML = this.capitalizeSentences(input);
            inputOutputBlock.appendChild(inputDiv);

            // Display output message
            const outputDiv = document.createElement('div');
            outputDiv.className = 'output-message';
            outputDiv.innerHTML = output;
            inputOutputBlock.appendChild(outputDiv);

            const references = outputDiv.getElementsByTagName('cite');
            for (const ref of references) {
                this.onReferenceClick(ref, metadata.pageCorrections);
            }
        }
    }

    setupChatSender(history) {
        this.chatSend.onclick = async () => {
            const msg = this.chatInput.value.trim();
            if (msg) {
                this.input(msg);
                history.addEntry(this.sessionID);
            }
        };
    }

    appendContainer(container) {
        // Append elements to chat container
        container.appendChild(this.mainContainer);
    }

    focusInput() {
        if (this.chatInput) this.chatInput.focus();
    }

    capitalizeSentences(msg) {
        return msg.replace(/(^\w{1}|\.\s*\w{1})/g, (c) => c.toUpperCase());
    }

    async input(msg) {
        if (msg) {
            this.chatInput.value = '';
            this.historyIndex = -1;
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;

            this.inputOutputBlock = document.createElement('div');
            this.inputOutputBlock.className = 'input-output-block';

            if (this.chatMessages.children.length > 0) {
                const hr = document.createElement('hr');
                hr.style.width = '100%';
                this.chatMessages.appendChild(hr);
            }
            this.chatMessages.appendChild(this.inputOutputBlock);

            // Display input message
            const msgDiv = document.createElement('p');
            msgDiv.className = 'input-message';
            msgDiv.innerHTML = this.capitalizeSentences(msg);
            this.inputOutputBlock.appendChild(msgDiv);

            await this.output(msg);

            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }
    }

    async output(msg) {
        const queryParams = new URLSearchParams({
            prompt: msg,
            embed_depth: this.embedDepth,
            model: this.model,
            user_id: localStorage.getItem('userID'),
            session_id: this.sessionID,
            entry_id: crypto.randomUUID(),
        })

        const msgDiv = document.createElement('div');
        msgDiv.className = 'output-message';
        this.inputOutputBlock.appendChild(msgDiv);

        let modelCreated = false;
        const waitingLoop = async () => {
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
                        }
                        else if (data.event === 'on_chat_model_stream') {
                            modelCreated = true;
                            const content = data.content;
                            if (!content.trim()) continue;

                            htmlBuffer += content;
                            msgDiv.innerHTML = htmlBuffer;
                            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
                        }

                        else if (data.event === 'on_chat_model_end') {
                            console.log('Response complete:', data);
                            const pageCorrections = data.page_corrections

                            const references = msgDiv.getElementsByTagName('cite');
                            for (const ref of references) {
                                this.onReferenceClick(ref, pageCorrections);
                            }

                            // Write to history file
                            console.log('Writing to history file');
                            await window.app.history.write(this.sessionID, {
                                input: msg,
                                output: htmlBuffer,
                                metadata: {
                                    pageCorrections: pageCorrections
                                }
                            });
                        }

                    } catch (err) {
                        console.error('Failed to parse event:', err);
                    }
                }
            }
        }
    }

    onReferenceClick(ref, pageCorrections) {
        const str = ref.textContent;
        const name = str.match(/EN.\d+/g)[0].replace(' ', '');
        const pageLabel = str.match(/page*.\d+/g)[0].match(/\d+/g)[0];

        const document = this.documents[name];
        const page = pageCorrections[document][pageLabel];

        ref.onclick = async (e) => {
            e.stopPropagation();
            await displayPDF(document, page, this.panel, ref);
        }
    }

    async displayWaitingMessage(div) {
        let i = 0;
        while (this.gptCreated) {
            div.innerHTML = `Processing documents ${".".repeat(i++ % 3 + 1)}`;
            await new Promise(resolve => setTimeout(resolve, 400));
        }
    }

    async autocomplete(input) {
        // Tab autocomplete for table name after 'from' with cycling, mid-word support
        const cmd = this.chatInput.value;
        const cmdLower = cmd.toLowerCase();
        // Match 'from' followed by any non-space chars (table name), possibly mid-word
        const match = (/table\s+([\w]*)/i.exec(cmdLower) || /from\s+([\w]*)/i.exec(cmdLower) || /describe\s+([\w]*)/i.exec(cmdLower));
        console.log('Autocomplete match:', match);
        if (match) {
            const partial = match[match.length - 1].toLowerCase();
            // Use tables as an array directly
            if (this.tabmatches.length === 0 || this.lastTabPrefix !== partial) {
                this.tabmatches = this.tableList.filter(t => t.toLowerCase().includes(partial));
                this.tabIndex = 0;
                this.lastTabPrefix = partial;
                this.originalInput = cmd;
            }
            if (this.tabmatches.length > 0) {
                input.preventDefault();
                const found = this.tabmatches[this.tabIndex];
                // Replace only the matched partial table name after 'from' with the full table name
                const partialStart = match.index + match[0].lastIndexOf(partial);
                this.chatInput.value = this.originalInput.substring(0, partialStart) + found + this.originalInput.substring(partialStart + partial.length);
                setTimeout(() => this.chatInput.setSelectionRange(partialStart + found.length, partialStart + found.length), 0);
                this.tabIndex = (this.tabIndex + 1) % this.tabmatches.length;
            } else {
                this.chatInput.value = this.originalInput;
            }
        } else {
            this.tabmatches = [];
            this.tabIndex = 0;
            this.lastTabPrefix = '';
            this.originalInput = '';
        }
    }

}


export class Pdf {
    constructor(pdfPath, sessionID = null, name = null) {
        this.name = name;
        this.sessionID = sessionID || crypto.randomUUID();
        this.viewer = `./pdfjs/web/viewer.html?file=${encodeURIComponent(pdfPath)}`; // Path to the PDF.js viewer
        this.createPdfViewer();
    }

    createPdfViewer() {
        // Use Mozilla's PDF.js viewer
        this.mainContainer = document.createElement('embed');
        this.mainContainer.className = 'pdf-viewer';
        this.mainContainer.id = `content:${this.sessionID}`;
        this.mainContainer.src = this.viewer;
        this.mainContainer.width = '100%';
        this.mainContainer.height = '100%';
        this.mainContainer.dataset.name = this.name;
    }

    setPage(page) {
        this.mainContainer.src = `${this.viewer}#page=${page}`;
    }

    appendContainer(container) {
        container.appendChild(this.mainContainer);
    }

    focusInput() {
        // No input to focus in PDF viewer
    }
}