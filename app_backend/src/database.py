import sqlite3
import os
from datetime import datetime

DATABASE_URL = os.environ['DATABASE_URL']
CONNECTION = sqlite3.connect(DATABASE_URL, check_same_thread=False)
CURSOR = CONNECTION.cursor()


def create_user(userID: str, username: str):
    try:
        CURSOR.execute("INSERT INTO users (userID, username) VALUES (?, ?)", (userID, username))
        CONNECTION.commit()
        return {"status": "success", "message": f"User '{username}' with ID '{userID}' added successfully."}
    except sqlite3.IntegrityError:
        return {"status": "warning", "message": f"User '{username}' with ID '{userID}' already exists."}
    

def new_entry(sql_query: str, parameters: tuple):
    try:
        CURSOR.execute(sql_query, parameters)
        CONNECTION.commit()
        return {"status": "success", "message": "Entry added successfully."}
    except sqlite3.IntegrityError as e:
        return {"status": "error", "message": str(e)}
    

def new_session(session_id: str, user_id: str, name: str, date_time: str|None = None) -> None:
    date_time = datetime.now().isoformat() if date_time is None else date_time
    try:
        CURSOR.execute("INSERT INTO sessions (sessionID, userID, name, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)", (session_id, user_id, name, date_time, date_time))
        CONNECTION.commit()
        print(f"Session \'{name}\' with ID \'{session_id}\' added successfully.")
    except sqlite3.IntegrityError:
        print(f"Session \'{name}\' with ID \'{session_id}\' already exists.")


def new_response(user_id: str, session_id: str, response_id: str, session_name: str, prompt: str, response: str) -> None:
    date_time = datetime.now().isoformat()
    new_session(session_id, user_id, session_name, date_time)

    try:
        CURSOR.execute("UPDATE sessions SET updatedAt = ? WHERE sessionID = ?", (date_time, session_id))
        CURSOR.execute("INSERT INTO responses (responseID, sessionID, prompt, response, timestamp) VALUES (?, ?, ?, ?, ?)", (response_id, session_id, prompt, response, date_time))
        CONNECTION.commit()
        print(f"Response with ID \'{response_id}\' added successfully.")
    except sqlite3.IntegrityError:
        print(f"Response with ID \'{response_id}\' already exists.")