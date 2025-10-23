import { Commands, chatHistoryNavigation } from "./commands.js";
import { settingsButtonHandler, displayPDF } from "./event-handlers.js";

export class Chatbox {
    constructor(index, panel, sessionID = null, history = null) {
        this.index = index;
        this.panel = panel;
        this.sessionID = sessionID || crypto.randomUUID();
        console.log('Chatbox sessionID:', this.sessionID);

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
        this.mainContainer = document.createElement('div');
        this.mainContainer.className = 'chat-container'; // Add a class for styling if needed
        this.mainContainer.dataset.index = this.index;
        this.mainContainer.id = `chatbox-${this.sessionID}`;

        // create chat messages area
        this.chatMessages = document.createElement('div');
        this.chatMessages.className = 'chat-messages border-color';

        // create chat input area
        const div = document.createElement('div');
        div.className = 'chat';

        this.settingsButton = document.createElement('button');
        this.settingsButton.className = 'chat-settings';
        this.settingsButton.textContent = '...';
        this.settingsButton.onclick = settingsButtonHandler.bind(this);

        this.chatInput = document.createElement('input');
        this.chatInput.className = 'chat-input';
        this.chatInput.type = 'text';
        this.chatInput.placeholder = 'Type your message here...';

        // create send button
        this.chatSend = document.createElement('button');
        this.chatSend.className = 'chat-send';
        this.chatSend.textContent = 'Send';

        div.appendChild(this.settingsButton);
        div.appendChild(this.chatInput);
        div.appendChild(this.chatSend);

        this.mainContainer.appendChild(this.chatMessages);
        this.mainContainer.appendChild(div);
    }

    loadHistory(history) {
        for (const { input, output } of history) {
            const inputOutputBlock = document.createElement('div');
            inputOutputBlock.className = 'input-output-block';

            if (this.chatMessages.children.length > 0) {
                const hr = document.createElement('hr');
                hr.style.width = '100%';
                this.chatMessages.appendChild(hr);
            }
            this.chatMessages.appendChild(inputOutputBlock);

            // Display input message
            const inputDiv = document.createElement('div');
            inputDiv.className = 'input-message';
            inputDiv.innerHTML = this.capitalizeSentences(input);
            inputOutputBlock.appendChild(inputDiv);

            // Display output message
            const outputDiv = document.createElement('div');
            outputDiv.className = 'output-message';
            outputDiv.innerHTML = output;
            inputOutputBlock.appendChild(outputDiv);
        }
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
            const msgDiv = document.createElement('div');
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
                            Array.from(references).forEach(async ref => {
                                const str = ref.textContent;
                                const name = str.match(/EN.\d+/g)[0].replace(' ', '');
                                const pageLabel = str.match(/page*.\d+/g)[0].match(/\d+/g)[0];

                                const document = this.documents[name];
                                const page = pageCorrections[document][pageLabel];

                                ref.onclick = async (e) => {
                                    e.stopPropagation();
                                    await displayPDF(document, page, this.panel, ref);
                                }
                            });

                            // Write to history file
                            console.log('Writing to history file');
                            await window.app.history.write(this.sessionID, {
                                input: msg,
                                output: htmlBuffer
                            });
                        }

                    } catch (err) {
                        console.error('Failed to parse event:', err);
                    }
                }
            }
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
    constructor(pdfPath, index, sessionID = null) {
        this.sessionID = sessionID || crypto.randomUUID();
        this.index = index;
        this.viewer = `./pdfjs/web/viewer.html?file=${encodeURIComponent(pdfPath)}`; // Path to the PDF.js viewer
        this.createPdfViewer();
    }

    createPdfViewer() {
        // Use Mozilla's PDF.js viewer
        this.mainContainer = document.createElement('embed');
        this.mainContainer.className = 'pdf-viewer';
        if (this.sessionID) this.mainContainer.id = `pdfviewer-${this.sessionID}`;
        this.mainContainer.src = this.viewer;
        this.mainContainer.width = '100%';
        this.mainContainer.height = '100%';
        this.mainContainer.dataset.index = this.index;
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