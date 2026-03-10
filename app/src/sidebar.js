const sidebar = document.getElementById('sidebar');
const chatHistory = document.getElementById('chat-history');
const account = document.getElementById('account');
const newChatButton = document.getElementById('new-chat-button');
const chatHistorySummary = document.getElementById('chat-history-summary');
const minHeight = chatHistorySummary.clientHeight;
const rect = chatHistory.getBoundingClientRect();
let isExpanded = true;
let animation = null;

const chatMessages = document.getElementById('chat-messages');

// Set max height of chat history based on sidebar height
chatHistory.style.maxHeight = (sidebar.clientHeight - rect.top) + 'px';

window.addEventListener('resize', function() {
    chatHistory.style.maxHeight = (sidebar.clientHeight - rect.top) + 'px';
});

function expandSidebar() {
    sidebar.classList.toggle('expanded');
    chatHistory.classList.toggle('hidden');
    chatHistorySummary.classList.toggle('hidden');
    newChatButton.classList.toggle('hidden');
    chatHistory.inert = !chatHistory.inert;
    chatHistorySummary.inert = !chatHistorySummary.inert;
    newChatButton.inert = !newChatButton.inert;
}

function animateHeight(height, duration, reverse) {
    const animation = chatHistory.animate([
        { height: reverse ? height + 'px' : minHeight + 'px' },
        { height: reverse ? minHeight + 'px' : height + 'px' }
    ], {
        duration: duration,
        easing: 'ease-in',
    });

    return animation;
}

function expandChatHistory(e) {
    // Rotate arrow
    chatHistorySummary.classList.toggle('rotate');

    // Calculate height based on number of entries and sidebar height
    const chatEntries = chatHistory.children;
    const sidebarHeight = sidebar.clientHeight - rect.top;
    const height = Math.min((chatEntries.length - 1) * 38 + minHeight, sidebarHeight);

    const duration = (height) * 1.2; // duration based on height

    if (animation) {
        // Reverse ongoing animation
        animation.reverse();
        isExpanded = !isExpanded;
        return;
    } else {
        // Start new animation
        animation = animateHeight(height, duration, isExpanded);
    }

    // Remove scrollbar if collapsing list
    if (isExpanded) {
        chatHistory.classList.remove('open');
    }

    animation.onfinish = function() {
        // Add scrollbar after fully expanding list
        chatHistory.classList.toggle('open', !isExpanded);

        isExpanded = !isExpanded;
        animation = null;
    };
}

function toggleTheme(e) {
    const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
    const themeButtonImg = document.getElementById('light-dark-mode').querySelector('img');
    if (isDarkMode) {
        document.documentElement.setAttribute('data-theme', 'light');
        themeButtonImg.src = 'assets/dark-mode.svg';
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeButtonImg.src = 'assets/light-mode.svg';
    }
}

function newChat(e) {
    var newChat = document.getElementById('new-chat');
    if (!newChat) {
        newChat = document.createElement('div');
        newChat.id = 'new-chat';
        chatMessages.prepend(newChat);
    }
}