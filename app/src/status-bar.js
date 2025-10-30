import { newHTMLElement, toggleHidden } from "./utils/html-helper-functions.js";

export class StatusBar {
    constructor() {
        this.createUI();
    }

    createUI() {
        this.statusBarDiv = newHTMLElement('div', null, {className: 'status-bar'});

        const ssh = newHTMLElement('div', this.statusBarDiv, {
            className: 'ssh-status disconnected',
            textContent: 'SSH: ><'
        });

        const sshMenu = newHTMLElement('div', this.statusBarDiv, {className: 'ssh-menu hidden'});

        const sshConnect = newHTMLElement('p', sshMenu, {
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

        ssh.onclick = function() {
            toggleHidden(sshMenu);
            sshUser.focus();
        }

        sshSubmit.onclick = async function () {
            const username = sshUser.value;
            const password = sshPass.value;

            if (username && password) {
                await window.app.ssh.connect(username, password);
                console.log('SSH connect invoked');
            }
        }

        document.body.appendChild(this.statusBarDiv);
    }
}