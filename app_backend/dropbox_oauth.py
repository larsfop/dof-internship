import webbrowser
import base64
import secrets
import hashlib
import requests
from dotenv import load_dotenv, set_key, get_key

from fastapi import FastAPI, Request
from fastapi.responses import RedirectResponse, HTMLResponse
import uvicorn


load_dotenv()
# get_key('.env', 'DROPBOX_API_KEY')
# set_key('.env', 'DROPBOX_API_KEY', '25qnd8cmj0jv2vv')

DROPBOX_API_KEY = get_key('.env', 'DROPBOX_API_KEY')
REDIRECT_URI = "http://localhost:3000/auth"

code_verifier = secrets.token_urlsafe(64)  # Generates a valid PKCE code_verifier
code_challenge = base64.urlsafe_b64encode(hashlib.sha256(code_verifier.encode('utf-8')).digest()).rstrip(b'=').decode('utf-8')

app = FastAPI()

@app.get("/")
def start_oauth(request: Request):
    auth_url = (
        f"https://www.dropbox.com/oauth2/authorize?response_type=code"
        f"&client_id={DROPBOX_API_KEY}"
        f"&redirect_uri={REDIRECT_URI}"
        f"&code_challenge={code_challenge}"
        f"&code_challenge_method=S256"
        f"&token_access_type=offline"
    )

    return RedirectResponse(auth_url)


@app.get("/auth")
def auth_callback(request: Request):
    code = request.query_params.get('code')
    data = {
        'code': code,
        'grant_type': 'authorization_code',
        'client_id': DROPBOX_API_KEY,
        'redirect_uri': REDIRECT_URI,
        'code_verifier': code_verifier
    }

    response = requests.post('https://api.dropbox.com/oauth2/token', data=data)

    if response.ok:
        token_data = response.json()
        refresh_token = token_data['refresh_token']

        set_key('.env', 'DROPBOX_REFRESH_TOKEN', refresh_token)
        return HTMLResponse("<h2>Authorization successful! You can close this tab.</h2>")
    else:
        return HTMLResponse("<h2>Authorization failed. Please try again.</h2>")
    


if __name__ == "__main__":
    webbrowser.open("http://localhost:3000")
    uvicorn.run(app, host="localhost", port=3000)

