export class Commands {
    constructor(chatInput) {
        this.chatInput = chatInput;
        this.tabmatches = [];
        this.tabIndex = 0;
        this.lastTabPrefix = '';
        this.originalInput = '';
    }

    handleTabCompletion(input) {
        const value = this.chatInput.value;
        const match = value.match(/from\s+(\w*)$/i);
        if (match) {
            const partial = match[1];
            if (partial !== this.lastTabPrefix) {
                // Reset tab matches if the prefix has changed
                this.tabmatches = []; // Fetch new matches based on the current input
                this.tabIndex = 0;
                this.lastTabPrefix = partial;
                this.originalInput = value;
            }
            // Simulate fetching table names from a database or predefined list
            // For example, let's assume we have a static list of table names
            const tableNames = ['users', 'orders', 'products', 'categories', 'transactions'];
            this.tabmatches = tableNames.filter(name => name.startsWith(partial));

            if (this.tabIndex === 0 && this.originalInput === '') {
                this.chatInput.value = value + this.tabmatches[0];
                setTimeout(() => this.chatInput.setSelectionRange(value.length + this.tabmatches[0].length, value.length + this.tabmatches[0].length), 0);
            }
            if (this.tabmatches.length > 0) {
                input.preventDefault();
                const found = this.tabmatches[this.tabIndex];
                // Replace only the matched partial table name after 'from' with the full table name
                const partialStart = match.index + match[0].lastIndexOf(partial);
                this.chatInput.value = this.originalInput.substring(0, partialStart) + found + this.originalInput.substring(partialStart + partial.length);
                setTimeout(() => this.chatInput.setSelectionRange(partialStart + found.length, partialStart + found.length), 0);
                this.tabIndex = (this.tabIndex + 1) % this.tabmatches.length;
            }
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
}