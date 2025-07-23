import { Table } from "./table.js";
import { Commands } from "./commands.js";

export class Chatbox {
    constructor(goldenLayout = false, id = null) {
        this.id = id
        this.createUI(goldenLayout);

        this.inputHistory = [];
        this.historyIndex = -1;

        this.tabmatches = [];
        this.tabIndex = 0;
        this.lastTabPrefix = '';
        this.originalInput = '';

        this.commands = new Commands(this.chatInput);

        this.createListeners();
    }

    async createListeners() {
        const tables = await window.database.queryTable('SELECT tableID,caption from document_metadata');
        this.lookupTable = {};
        this.tableList = [];
        tables.forEach((table) => {
            this.lookupTable[table.caption] = table.tableID;
            this.tableList.push(table.caption);
        });

        // Tab autocomplete for table name after 'from' with cycling support
        this.chatInput.addEventListener('keydown', this.hotkeys.bind(this));
    }

    createUI(goldenLayout) {
        if (goldenLayout) {
            this.mainContainer = document.createElement('div');
            this.mainContainer.id = 'chat-container';
            this.mainContainer.style.width = 'inherit';
            this.mainContainer.style.height = 'inherit';
        } else {
            this.mainContainer = document.createElement('div');
            this.mainContainer.className = 'chat-container'; // Add a class for styling if needed
        }

        // create chat messages area
        this.chatMessages = document.createElement('div');
        this.chatMessages.className = 'chat-messages';
        if (this.id) this.chatMessages.id = this.id;
        this.chatMessages.style.height = 'calc(100% - 36px)';
        this.chatMessages.style.overflowY = 'auto';
        this.chatMessages.style.overflowX = 'hidden'; // Hide horizontal overflow
        this.chatMessages.style.borderBottom = '1px solid #eee';
        this.chatMessages.style.marginBottom = '13px';
        this.chatMessages.style.marginLeft = '15px';
        this.chatMessages.style.marginRight = '15px';
        this.chatMessages.style.marginTop = '25px';
        this.chatMessages.style.paddingBottom = '2px'

        // create chat input area
        this.chatInput = document.createElement('input');
        this.chatInput.className = 'chat-input';
        this.chatInput.type = 'text';
        this.chatInput.placeholder = 'Type your message here...';
        this.chatInput.style.width = 'calc(100% - 80px)';
        this.chatInput.style.marginLeft = '15px';
        this.chatInput.style.marginBottom = '15px';

        // create send button
        this.chatSend = document.createElement('button');
        this.chatSend.className = 'chat-send';
        this.chatSend.textContent = 'Send';

        this.mainContainer.appendChild(this.chatMessages);
        this.mainContainer.appendChild(this.chatInput);
        this.mainContainer.appendChild(this.chatSend);
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

    async input(msg) {
        if (msg) {
            // Only save if not a repeat of the last input
            if (this.inputHistory.length === 0 || this.inputHistory[this.inputHistory.length - 1] !== msg) {
                this.inputHistory.push(msg);
            }

            const msg_lower = msg.toLowerCase();

            this.historyIndex = this.inputHistory.length;

            if (msg_lower.startsWith('table') || msg_lower.startsWith('select') || msg_lower.startsWith('show') || msg_lower.startsWith('describe')) {
            // if (msg.startsWith('select ') || msg.startsWith('SELECT ') || msg.startsWith('show ') || msg.startsWith('SHOW ') || msg.startsWith('describe ') || msg.startsWith('DESCRIBE ')) {
                this.chatInput.value = '';
                return await this.displayTable(msg);
            } else {
                const msgDiv = document.createElement('div');
                msgDiv.textContent = msg;
                this.chatMessages.appendChild(msgDiv);
                this.chatInput.value = '';
                this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
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
            }else if (msg.toLowerCase().startsWith('table')) {
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
            this.chatMessages.appendChild(table.div);
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }
        else {
            this.displayError(new Error(result || 'No results returned.'));
        }
        return table;
    }

    displayError(err) {
        const div = document.createElement('div');
        div.textContent = err.message;
        this.chatMessages.appendChild(div);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    hotkeys(input) {
        if (input.key === 'Enter') {
            this.chatSend.click();
        } else if (input.key === 'ArrowUp') {
            if (this.inputHistory.length > 0 && this.historyIndex > 0) {
                this.historyIndex--;
                this.chatInput.value = this.inputHistory[this.historyIndex];
                setTimeout(() => this.chatInput.setSelectionRange(this.chatInput.value.length, this.chatInput.value.length), 0);
            }
        } else if (input.key === 'ArrowDown') {
            if (this.inputHistory.length > 0 && this.historyIndex < this.inputHistory.length - 1) {
                this.historyIndex++;
                this.chatInput.value = this.inputHistory[this.historyIndex];
                setTimeout(() => this.chatInput.setSelectionRange(this.chatInput.value.length, this.chatInput.value.length), 0);
            } else if (this.historyIndex === this.inputHistory.length - 1) {
                this.historyIndex++;
                this.chatInput.value = '';
            }
        } else if (input.key === 'Tab') {
            // Tab autocomplete for table name after 'from' with cycling, mid-word support
            this.autocomplete(input);
        } else {
            // Reset tab matches if not typing a table name
            this.tabmatches = [];
            this.tabIndex = 0;
            this.lastTabPrefix = '';
            this.originalInput = '';
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
    constructor(pdfPath, id = null) {
        this.id = id;
        this.viewer = `./pdfjs/web/viewer.html?file=${encodeURIComponent(pdfPath)}`; // Path to the PDF.js viewer
        this.createPdfViewer();

        console.log(pdfPath)
    }

    createPdfViewer() {
        // built-in PDF viewer
        // this.mainContainer = document.createElement('div');
        // this.mainContainer.className = 'pdf-viewer'; // Add a class for styling if needed
        // this.mainContainer.innerHTML = `<embed src="${this.pdfPath}" width="100%" height="100%"></embed>`;
        // this.mainContainer.style.width = '100%';
        // this.mainContainer.style.height = '100%'; // Adjust height as needed

        // Use Mozilla's PDF.js viewer
        this.mainContainer = document.createElement('embed');
        this.mainContainer.className = 'pdf-viewer';
        if (this.id) this.mainContainer.id = this.id;
        this.mainContainer.src = this.viewer;
        this.mainContainer.width = '100%';
        this.mainContainer.height = '100%';
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