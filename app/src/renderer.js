import { setupStatusBarMenu } from './status-bar.js';
import { loadHistory } from './history/history.js';
import { createPanel } from './panel.js';
import { newTab, loadLastTab } from './tab.js';
import { newHTMLElement, toggleHidden, documentBodyClickHandler } from './utils/html-helper-functions.js';
import { dragEndHandler, dragEnterHandler } from './event-handlers.js';
// import * as Split from '../node_modules/split-grid/dist/split-grid.js';


// Chatbox and tabs logic for renderer process
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', async function () {

        window.addEventListener('dragover', (e) => {
            e.preventDefault();
        });
        window.addEventListener('drop', (e) => {
            e.preventDefault();
        });


        // Show intital login form
        const createUserDiv = document.querySelector('.create-user');
        toggleHidden(createUserDiv, false);

        const form = document.getElementById('signup-form');
        const username = document.getElementById('username');
        const password = document.getElementById('password');

        form.addEventListener('submit', async function (e) {
            e.preventDefault();

            const formData = new URLSearchParams({
                username: username.value,
                password: password.value
            })

            const response = await fetch('http://localhost:8015/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: formData.toString()
            })

            const data = await response.json();
            
            if (!response.ok) throw new Error(data.detail)

            sessionStorage.setItem('userID', data.user_id);
            sessionStorage.setItem('access_token', data.access_token);
            sessionStorage.setItem('token_type', data.token_type);
            account.textContent = username.value[0];

            console.log(username.value, data)

            initializeMain();

            form.parentElement.style.display = 'none';
        });

    });
}


function setupLayout() {
    const main = document.getElementById('main');

    // Load chat history
    loadHistory();
    
    // Setup initial new tab
    const panel = createPanel(main, true);
    newTab(panel, 'chatbot');
    
    // Event listeners for highlights
    document.addEventListener('dragenter', dragEnterHandler);
    document.addEventListener('dragend', dragEndHandler);
}

function initializeMain() {
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

}
