import { StatusBar } from './status-bar.js';
import { HistoryMenu } from './history/history.js';
import { Panel } from './panel.js';
import { newHTMLElement, toggleHidden } from './utils/html-helper-functions.js';
import * as Split from '../node_modules/split-grid/dist/split-grid.js';

function createUserID() {
    if (!localStorage.getItem('userID')) {
        const userID = crypto.randomUUID();
        localStorage.setItem('userID', 'test_user');
    }
}

function setupLayout() {
    const layout = newHTMLElement('div', document.body, { className: 'layout-container' }, {});
    const sidebar = newHTMLElement('div', layout, 
        { className: 'sidebar' }, 
    );
    const sidebarExpandBtn = newHTMLElement('button', sidebar,
        { className: 'sidebar-button', textContent: '☰' }, 
    );

    const history = new HistoryMenu();
    history.createUI(sidebar);
    history.loadHistory();

    sidebarExpandBtn.onclick = () => {
        sidebar.classList.toggle('expanded');
        history.toggleExpand();
    };

    const panel = new Panel(layout, null, true);
    panel.panelContainer.style.gridArea = 'main';
    const tab = panel.addTab('chatbox', null);

    const statusBar = new StatusBar(layout);

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

        // Set up the main layout
        setupLayout();

        document.addEventListener('click', function(e) {
            const chatMenus = document.querySelectorAll('.chat-menu-container');
            console.log(e.target);
            if (e.target.classList.contains('chat-settings')) return;
            
            for (const menu of chatMenus) {
                if (menu.contains(e.target)) continue;
                const children = Array.from(menu.children);
                for (const child of children) {
                    const rect = child.getBoundingClientRect();
                    if (e.clientX >= rect.left && e.clientX <= rect.right &&
                        e.clientY >= rect.top && e.clientY <= rect.bottom) {
                        return; // Click inside the menu, do nothing
                    }

                    toggleHidden(child, true);
                }
            }
        });


    });
}