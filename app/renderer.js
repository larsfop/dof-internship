// import { Tabs } from './tabs.js';
import { Chatbox } from './chatbox.js';

// Chatbox logic for renderer process
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', async () => {
        const chatbox = new Chatbox();
        chatbox.createListeners();
    });
}