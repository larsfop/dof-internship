import { Table } from "./table.js";
import { Commands, chatHistoryNavigation } from "./commands.js";
import { settingsButtonHandler, displayPDF } from "./event-handlers.js";

export class Chatbox {
    constructor(index, panel) {
        this.index = index;
        this.panel = panel;
        this.createUI();

        this.documents = {
            'EN1992': 'ns-en-1992-1-1_2004+a1_2014+na_2024_en_002.pdf',
            'EN1995': 'ns-en-1995-1-1_2004+a2_2014+na_2024_en_001.pdf'
        }

        this.inputHistory = [];
        this.historyIndex = -1;
        this.sessionID = crypto.randomUUID();

        this.tabmatches = [];
        this.tabIndex = 0;
        this.lastTabPrefix = '';
        this.originalInput = '';

        this.model = 'gpt-4.1';
        this.embedDepth = 0;
        this.responseID = null;
        this.usePreviousResponse = false;

        this.commands = new Commands(this.chatInput);

        this.createListeners();
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

    async setupTables() {
        const tables = await window.database.queryTable('SELECT tableID,caption from document_metadata');
        console.log('Tables:', tables);

        this.lookupTable = {};
        tables.forEach((table) => {
            this.lookupTable[table.caption] = table.tableID;
        })
        console.log('Lookup Table:', this.lookupTable);
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

    async input(msg, panel) {
        if (msg) {
            // Only save if not a repeat of the last input
            if (this.inputHistory.length === 0 || this.inputHistory[this.inputHistory.length - 1] !== msg) {
                this.inputHistory.push(msg);
            }
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

            const output = await this.output(msg, panel);

            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
            return output;
        }
    }

    async output(msg, panel) {
        const queryParams = new URLSearchParams({
            query: msg,
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
                        }

                    } catch (err) {
                        console.error('Failed to parse event:', err);
                    }
                }
            }
        }
    }

    async displayTable(msg) {
        const tableCmds = ['table', 'select', 'describe'];

        const msgSplit = msg.trim().split(/\s+/);
        var tableName = msgSplit.pop();
        console.log(msg, msgSplit, tableName);
        if (tableCmds.includes(msg.split(/\s+/)[0].toLowerCase())) {
            if (!this.lookupTable[tableName]) {
                this.displayError(new Error(`Table "${tableName}" not found.`));
                return;
            } else if (msg.toLowerCase().startsWith('table')) {
                var sql = msg.replace(/table\s.*/i, `select * from ${this.lookupTable[tableName]}`);
            } else if (msg.toLowerCase().startsWith('describe')) {
                var sql = msg.replace(/describe\s.*/i, `describe ${this.lookupTable[tableName]}`);
            } else if (msg.toLowerCase().startsWith('select')) {
                var sql = msg.replace(/from\s.*(\w+)/i, `from ${this.lookupTable[tableName]}`);
            }
        } else if (msg.toLowerCase().startsWith('show')) {
            if (msgSplit.length > 0) {
                console.log('Searching for table:', tableName);
                var sql = `select title, tableName, page, tableNumber from document_metadata where title like "%${tableName}%" order by page`
            } else {
                var sql = 'select title, tableName, page, tableNumber from document_metadata order by page'
            }
            tableName = 'Document Tables'
        } else {
            this.displayError(new Error(`Invalid command: ${msg}`));
            return;
        }

        console.log('Executing SQL:', sql);
        // Call backend to execute SQL and get result
        const result = await window.database.queryTable(sql);
        console.log('SQL Result:', result);

        if (result) {
            const query = await window.database.queryTable(
                `select tableName from document_metadata where caption = "${tableName}"` // Get the table name from metadata
            )
            const caption = query[0] ? query[0].tableName : tableName; // Use the table name from metadata or fallback to the last part of the SQL command
            var table = new Table(this.lookupTable[tableName]);
            await table.createTable(result, caption);
            table.createListeners();
            this.inputOutputBlock.appendChild(table.div);
        }
        else {
            this.displayError(new Error(result || 'No results returned.'));
        }
        return table;
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
    constructor(pdfPath, index, id) {
        this.id = id;
        this.index = index;
        this.viewer = `./pdfjs/web/viewer.html?file=${encodeURIComponent(pdfPath)}`; // Path to the PDF.js viewer
        this.createPdfViewer();
    }

    createPdfViewer() {
        // Use Mozilla's PDF.js viewer
        this.mainContainer = document.createElement('embed');
        this.mainContainer.className = 'pdf-viewer';
        if (this.id) this.mainContainer.id = this.id;
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