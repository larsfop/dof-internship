import { setupStatusBarMenu } from './status-bar.js';
import { setupHistoryMenu } from './history/history.js';
import { createPanel } from './panel.js';
import { newTab, loadLastTab } from './tab.js';
import { newHTMLElement, toggleHidden, documentBodyClickHandler } from './utils/html-helper-functions.js';
import { dragEndHandler, dragEnterHandler } from './event-handlers.js';
// import * as Split from '../node_modules/split-grid/dist/split-grid.js';

async function createUserID() {
    if (!localStorage.getItem('userID')) {
        const userID = crypto.randomUUID();
        localStorage.setItem('userID', userID);

        const params = new URLSearchParams({
            userID: userID,
            username: 'test_user',
        });
        await fetch(`http://localhost:8015/create_user?${params.toString()}`)
    }
}

function setupSidebarMenu(layoutDiv) {
    const sidebar = newHTMLElement('div', layoutDiv, 
        { className: 'sidebar' }, 
    );
    const sidebarExpandBtn = newHTMLElement('button', sidebar,
        { className: 'sidebar-button', textContent: '☰' }, 
    );

    const historyDiv = setupHistoryMenu(sidebar);

    sidebarExpandBtn.onclick = function() {
        sidebar.classList.toggle('expanded');
        toggleHidden(historyDiv);
    }
}

function setupLayout() {
    const layout = newHTMLElement('div', document.body, 
        { className: 'layout-container' },
    );
    
    setupSidebarMenu(layout);

    const panel = createPanel(layout, true);
    newTab(panel, 'chatbot');
    
    // Event listeners for highlights
    document.addEventListener('dragenter', dragEnterHandler);
    document.addEventListener('dragend', dragEndHandler);

    setupStatusBarMenu(layout);
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

        // Ensure a user ID is set for logging purposes
        await createUserID();

        // Set up the main layout
        setupLayout();

        document.addEventListener('click', documentBodyClickHandler);


        // Mouse and keyboard shortcuts

        document.addEventListener('mousedown', function(e) {
            switch (e.button) {
            case 1:
                // Middle mouse button: Close tab
                e.preventDefault();
                const tab = e.target.closest('.tab');
                if (tab) {
                    tab.lastChild.click(); // Simulate click on close button
                }
                break;
            default:
                break;
            }
        })

        document.addEventListener('keydown', (e) => {
            const activePanel = document.querySelector('.panel-container.last-active');
            const activeTab = activePanel.querySelector('.tab.active');

            switch (e.key.toLowerCase()) {
                case e.ctrlKey && e.shiftKey && 't':
                    // Ctrl+Shift+T: Reopen previously closed tab
                    e.preventDefault();
                    loadLastTab();
                    break;
                case e.ctrlKey && e.shiftKey && 'w':
                    // Ctrl+Shift+W: Close all tabs in active panel
                    e.preventDefault();
                    if (!activePanel) return;
                    const tabs = activePanel.querySelectorAll('.tab');
                    for (const tab of tabs) {
                        tab.lastChild.click();
                    }
                    break;
                case e.ctrlKey && 't':
                    // Ctrl+T: New tab
                    e.preventDefault();
                    if (!activePanel) return;
                    newTab(activePanel, 'chatbot');
                    break;
                case e.ctrlKey && 'w':
                    // Ctrl+W: Close tab
                    e.preventDefault();
                    if (!activeTab) return;
                    activeTab.lastChild.click();
                    break;

                default:
                    break;
            }
        });

    });
}