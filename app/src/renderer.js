import { Layout } from './layout.js';
import { StatusBar } from './status-bar.js';

function createUserID() {
    if (!localStorage.getItem('userID')) {
        const userID = crypto.randomUUID();
        localStorage.setItem('userID', 'test_user');
    }
}

// Chatbox and tabs logic for renderer process
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', async () => {

        window.addEventListener('dragover', (e) => {
            e.preventDefault();
        });
        window.addEventListener('drop', (e) => {
            e.preventDefault();
        });

        function updateTabTheme() {
            const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const tabs = document.getElementsByClassName('tab');
            [...tabs].forEach(tab => {
                tab.classList.remove('tab-dark-mode', 'tab-light-mode');
                tab.classList.add(isDark ? 'tab-dark-mode' : 'tab-light-mode');
            });
        }

        // Ensure a user ID is set for logging purposes
        createUserID();

        // Initial theme set
        updateTabTheme();
        // Listen for theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateTabTheme);

        const appLayout = new Layout();
        const statusBar = new StatusBar();

        document.addEventListener('click', function(e) {
            const chatMenus = document.querySelectorAll('.chat-menu');
            console.log(e.target);
            if (e.target.classList.contains('chat-settings')) return;
            
            for (const menu of chatMenus) {
                const rect = menu.getBoundingClientRect();
                if (e.clientX >= rect.left && e.clientX <= rect.right &&
                    e.clientY >= rect.top && e.clientY <= rect.bottom) {
                    return; // Click inside the menu, do nothing
                }

                menu.classList.add('hidden');
                menu.setAttribute('inert', '');
            }
        });


    });
}