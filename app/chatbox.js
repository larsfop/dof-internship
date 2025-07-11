import { Table } from "./table.js";

export class Chatbox {
    constructor() {
        this.chatContainer = document.getElementById('chat-container');
        this.createUI();

        this.inputHistory = [];
        this.historyIndex = -1;

        this.tabmatches = [];
        this.tabIndex = 0;
        this.lastTabPrefix = '';
        this.originalInput = '';

        this.createListeners();
    }

    createListeners() {
        this.chatSend.addEventListener('click', () => {
            const msg = this.chatInput.value.trim();
            this.input(msg);
        });

        // Tab autocomplete for table name after 'from' with cycling support
        this.chatInput.addEventListener('keydown', (e) => {
            this.hotkeys(e);
        });
    }

    createUI() {
        // create chat messages area
        this.chatMessages = document.createElement('div');
        this.chatMessages.id = 'chat-messages';
        this.chatMessages.style.height = 'calc(100vh - 100px)';
        this.chatMessages.style.overflowY = 'auto';
        this.chatMessages.style.borderBottom = '1px solid #eee';
        this.chatMessages.style.marginBottom = '10px';
        this.chatMessages.style.padding = '2px';

        // create chat input area
        this.chatInput = document.createElement('input');
        this.chatInput.id = 'chat-input';
        this.chatInput.type = 'text';
        this.chatInput.placeholder = 'Type your message here...';
        this.chatInput.style.width = 'calc(100% - 80px)';

        // create send button
        this.chatSend = document.createElement('button');
        this.chatSend.id = 'chat-send';
        this.chatSend.textContent = 'Send';
    }

    appendContainer() {
        this.chatContainer.innerHTML = ''; // Clear previous content
        // Append elements to chat container
        this.chatContainer.appendChild(this.chatMessages);
        this.chatContainer.appendChild(this.chatInput);
        this.chatContainer.appendChild(this.chatSend);
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

            this.historyIndex = this.inputHistory.length;

            if (msg.startsWith('select ') || msg.startsWith('SELECT ') || msg.startsWith('show ') || msg.startsWith('SHOW ') || msg.startsWith('describe ') || msg.startsWith('DESCRIBE ')) {
                // SQL query command
                const sql = msg;
                console.log('Executing SQL:', sql);
                // Call backend to execute SQL and get result
                const result = await window.database.queryTable(sql);
                console.log('SQL Result:', result);

                if (result.success) {
                    const caption = msg.split(/\s+/).pop();
                    const table = new Table(result.results, caption);
                    this.chatMessages.appendChild(table.div);
                    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
                } else {
                    this.displayError(new Error(result.message || 'No results returned.'));
                }
                
                this.chatInput.value = '';
            } else {
                const msgDiv = document.createElement('div');
                msgDiv.textContent = msg;
                this.chatMessages.appendChild(msgDiv);
                this.chatInput.value = '';
                this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
            }
        }
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
        const value = this.chatInput.value;
        // Match 'from' followed by any non-space chars (table name), possibly mid-word
        const match = (/from\s+([\w]*)/i.exec(value) || /FROM\s+([\w]*)/i.exec(value) || /describe\s+([\w]*)/i.exec(value) || /DESCRIBE\s+([\w]*)/i.exec(value));
        if (match) {
            const tables = await window.database.getTables();
            const partial = match[1].toLowerCase();
            // Use tables as an array directly
            if (this.tabmatches.length === 0 || this.lastTabPrefix !== partial) {
                const tableList = Array.isArray(tables) ? tables : (tables && tables.lookupTable ? tables.lookupTable : []);
                this.tabmatches = tableList.filter(t => t.toLowerCase().includes(partial));
                this.tabIndex = 0;
                this.lastTabPrefix = partial;
                this.originalInput = value;
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