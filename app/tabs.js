export class Tabs {
    constructor() {
        this.tabs = [];
    }

    addTab(tab) {
        this.tabs.push(tab);
    }

    removeTab(tab) {
        this.tabs = this.tabs.filter(t => t !== tab);
    }

    getTabs() {
        return this.tabs;
    }
}