import { Tabs } from './tabs.js';
// import { Chatbox } from './chatbox.js';

// Chatbox and tabs logic for renderer process
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', async () => {
        const tabs = new Tabs();
    });
}