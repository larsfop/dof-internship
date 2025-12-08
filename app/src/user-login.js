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

    form.parentElement.style.display = 'none';
});