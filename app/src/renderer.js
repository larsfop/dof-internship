import { StatusBar } from './status-bar.js';
import { HistoryMenu } from './history/history.js';
import { Panel } from './panel.js';
import { Tabs } from './tabs.js';
import { newHTMLElement, setLastActive, toggleHidden, documentBodyClickHandler } from './utils/html-helper-functions.js';
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

    return { layout, sidebar, statusBar, history}
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
        const { layout, sidebar, statusBar, history } = setupLayout();

        document.addEventListener('click', documentBodyClickHandler);

        document.addEventListener('keydown', (e) => {
            const activePanel = document.querySelector('.panel-container.last-active');
            const activeTab = activePanel.querySelector('.tab.active');

            switch (e.key) {
                case e.ctrlKey && 't':
                    // Ctrl+T: New tab
                    e.preventDefault();
                    if (!activePanel) return;
                    const tab = new Tabs();
                    tab.setupContent('chatbox', null);
                    tab.appendContainer(activePanel);
                    tab.changeTab();
                    break;
                case e.ctrlKey && 'w':
                    // Ctrl+W: Close tab
                    e.preventDefault();
                    if (!activeTab) return;
                    activeTab.lastChild.click();
                    break;
                case e.ctrlKey && 'T':
                    // Ctrl+Shift+T: Reopen previously closed tab
                    e.preventDefault();
                    history.loadLastTab();
                    break;
                case e.ctrlKey && 'W':
                    // Ctrl+Shift+W: Close all tabs in active panel
                    e.preventDefault();
                    if (!activePanel) return;
                    const tabs = activePanel.querySelectorAll('.tab');
                    for (const tab of tabs) {
                        tab.lastChild.click();
                    }
                    break;

                default:
                    break;
            }
        });

    });
}