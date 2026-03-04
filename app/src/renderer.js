import { loadHistory } from './history/history.js';
import { toggleHidden, documentBodyClickHandler, handleColorThemeChange } from './utils/html-helper-functions.js';


// Chatbox and tabs logic for renderer process
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', async function () {

        // Set color theme based on user preference
        const themePreference = window.matchMedia('(prefers-color-scheme: dark)')
        handleColorThemeChange(themePreference);
        themePreference.addEventListener('change', handleColorThemeChange);


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

            const response = await fetch('http://192.168.0.71:8015/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: formData.toString()
            })

            const data = await response.json();
            if (!response.ok) {
                alert(`Login failed: ${data.detail}`);
                return;
            }
            
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

function initializeMain() {
    loadHistory();

    document.addEventListener('click', documentBodyClickHandler);
}
