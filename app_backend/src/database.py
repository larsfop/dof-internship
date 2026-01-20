import psycopg
import json
import os
from datetime import datetime
from uuid import uuid4
from uuid import UUID

from dotenv import load_dotenv
from pydantic_classes import UserInDB

db_uri = 'postgresql+psycopg://{user}:{password}@postgres:5432/postgres?sslmode=disable'.format(
    user=os.environ['POSTGRES_USER'],
    password=os.environ['POSTGRES_PASSWORD'],
)
CONNECTION = psycopg.connect(db_uri)
CURSOR = CONNECTION.cursor()


def create_user(userID: str|UUID, username: str, hashed_password: str):
    try:
        CURSOR.execute(
            "INSERT INTO users (userID, username, hashedPassword) VALUES (%s, %s, %s)",
            (str(userID), username, hashed_password)
        )
        CONNECTION.commit()
        return {"status": "success", "message": f"User '{username}' with ID '{userID}' added successfully."}
    except psycopg.IntegrityError:
        return {"status": "warning", "message": f"User '{username}' with ID '{userID}' already exists."}
    

def new_entry(sql_query: str, parameters: tuple):
    try:
        CURSOR.execute(sql_query, parameters)
        CONNECTION.commit()
        return {"status": "success", "message": "Entry added successfully."}
    except psycopg.IntegrityError as e:
        return {"status": "error", "message": str(e)}
    

def new_session(session_id: str, user_id: str, name: str, date_time: str|None = None) -> None:
    date_time = datetime.now().isoformat() if date_time is None else date_time
    try:
        CURSOR.execute(
            "INSERT INTO sessions (sessionID, userID, name, createdAt, updatedAt) VALUES (%s, %s, %s, %s, %s)",
            (session_id, user_id, name, date_time, date_time)
        )
        CONNECTION.commit()
        print(f"Session \'{name}\' with ID \'{session_id}\' added successfully.")
    except psycopg.IntegrityError:
        print(f"Session \'{name}\' with ID \'{session_id}\' already exists.")


def new_response(user_id: str, session_id: str, response_id: str, session_name: str, prompt: str, response: str) -> None:
    date_time = datetime.now().isoformat()
    new_session(session_id, user_id, session_name, date_time)

    try:
        CURSOR.execute("UPDATE sessions SET updatedAt = %s WHERE sessionID = %s", (date_time, session_id))
        CURSOR.execute(
            "INSERT INTO responses (responseID, sessionID, prompt, response, timestamp) VALUES (%s, %s, %s, %s, %s)",
            (response_id, session_id, prompt, response, date_time)
        )
        CONNECTION.commit()
        print(f"Response with ID \'{response_id}\' added successfully.")
    except psycopg.IntegrityError:
        print(f"Response with ID \'{response_id}\' already exists.")


def new_citation(response_id: str, document_name: str, page_labels: str, pdf_pages: str) -> None:
    try:
        CURSOR.execute(
            "INSERT INTO citations (responseID, documentName, pageLabels, pdfPages) VALUES (%s, %s, %s, %s)",
            (response_id, document_name, page_labels, pdf_pages)
        )
        CONNECTION.commit()
        print(f"Citation for response ID \'{response_id}\' added successfully.")
    except psycopg.IntegrityError:
        print(f"Citation for response ID \'{response_id}\' already exists.")


def fetch_user(username: str) -> UserInDB|None:
    data = CURSOR.execute(
        "SELECT json_build_object('userID', userID, 'username', username, 'hashed_password', hashedPassword) FROM users WHERE username = %s",
        (username,)
    ).fetchone()
    if data:
        return UserInDB(**json.loads(data[0]))
