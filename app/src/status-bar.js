import { newHTMLElement, toggleHidden } from "./utils/html-helper-functions.js";

export function setupStatusBarMenu(parentDiv) {
    const statusBarDiv = newHTMLElement('div', null, {className: 'status-bar'});

    const ssh = newHTMLElement('div', statusBarDiv, {
        className: 'ssh-status disconnected',
        textContent: 'SSH: ><'
    });

    const sshMenu = newHTMLElement('div', statusBarDiv, {className: 'ssh-menu hidden'});

    newHTMLElement('p', sshMenu, {
        className: 'ssh-connect',
        textContent: 'Connect to SSH'
    });

    const sshUser = newHTMLElement('input', sshMenu, {
        type: 'text',
        placeholder: 'Username',
        className: 'ssh-username-input'
    });

    const sshPass = newHTMLElement('input', sshMenu, {
        type: 'password',
        placeholder: 'Password',
        className: 'ssh-password-input'
    });

    const sshSubmit = newHTMLElement('button', sshMenu, {
        className: 'ssh-submit',
        textContent: 'Connect'
    });

    function hideSSHMenuOnClickOutside(e) {
        if (!sshMenu.contains(e.target) && e.target !== ssh) {
            toggleHidden(sshMenu, true);
            document.removeEventListener('click', hideSSHMenuOnClickOutside);
        }
    }

    ssh.onclick = function() {
        toggleHidden(sshMenu);
        sshUser.focus();

        document.addEventListener('click', hideSSHMenuOnClickOutside);
    }

    sshSubmit.onclick = async function () {
        const username = sshUser.value;
        const password = sshPass.value;

        if (username && password) {
            await window.app.ssh.connect(username, password);
            console.log('SSH connect invoked');
            ssh.classList.remove('disconnected');
            ssh.classList.add('connected');
            toggleHidden(sshMenu, true);
        }
    }

    parentDiv.appendChild(statusBarDiv);
}