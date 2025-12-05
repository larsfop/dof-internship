function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const history = document.getElementById('history');
    sidebar.classList.toggle('expanded');
    history.classList.toggle('hidden');
}

function expandHistory(button) {
    button.nextElementSibling.classList.toggle('expanded');
}