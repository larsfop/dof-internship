import webbrowser
import base64
import secrets
import hashlib
import requests
from dotenv import load_dotenv, set_key, get_key
import os
import signal

from fastapi import FastAPI, Request
from fastapi.responses import RedirectResponse, HTMLResponse
import uvicorn

load_dotenv()

DROPBOX_API_KEY = get_key('.env', 'DROPBOX_API_KEY')
REDIRECT_URI = "http://localhost:3000/auth"

code_verifier = secrets.token_urlsafe(64)
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
        os.kill(os.getpid(), signal.SIGINT)
        print("Dropbox OAuth successful. Refresh token saved to .env file.", flush=True)
    else:
        os.kill(os.getpid(), signal.SIGINT)
        print("Dropbox OAuth failed. Please try again.", flush=True)



if __name__ == "__main__":
    webbrowser.open("http://localhost:3000")
    uvicorn.run(app, host="localhost", port=3000)

