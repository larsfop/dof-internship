import { loadHistory } from './history/history.js';
import { toggleHidden, documentBodyClickHandler, handleColorThemeChange } from './utils/html-helper-functions.js';


// Chatbox and tabs logic for renderer process
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', async function () {
        // Set color theme based on user preference
        const themePreference = window.matchMedia('(prefers-color-scheme: dark)')
        handleColorThemeChange(themePreference);
        themePreference.addEventListener('change', handleColorThemeChange);

        // Create userId if it doesn't exist
        if (!localStorage.getItem('userID')) {
            localStorage.setItem('userID', crypto.randomUUID());
        }

        loadHistory();

        document.addEventListener('click', documentBodyClickHandler);
    });
}