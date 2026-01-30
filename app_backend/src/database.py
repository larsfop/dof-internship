import psycopg
from psycopg import Cursor
from psycopg.rows import dict_row, RowMaker
import json
import os
from datetime import datetime
from uuid import UUID
from typing import Any, Sequence
import logging

from pydantic_classes import UserInDB

def dict_factory(cursor: Cursor, row):
    fields = [column[0] for column in cursor.description]
    return {key: value for key, value in zip(fields, row)}


def dict_factory(cursor: Cursor[Any]) -> RowMaker[dict[str, Any]]:
    fields = [c.name for c in cursor.description]

    def make_row(values: Sequence[Any]) -> dict[str, Any]:
        return dict(zip(fields, values))

    return make_row


# db_uri = 'postgresql://postgres:admin125@localhost:5435/postgres?sslmode=disable'
db_uri = 'postgresql://{user}:{password}@postgres:5432/postgres?sslmode=disable'.format(
    user=os.environ['POSTGRES_USER'],
    password=os.environ['POSTGRES_PASSWORD'],
)
CONNECTION = psycopg.connect(db_uri, row_factory=dict_row)
CURSOR = CONNECTION.cursor()

logger = logging.getLogger('main')

def setup_databases() -> None:
    try:
        CURSOR.execute("""
            CREATE TABLE IF NOT EXISTS users (
                userID UUID PRIMARY KEY,
                username TEXT NOT NULL,
                hashedPassword TEXT NOT NULL
            );
        """)
        CURSOR.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                sessionID UUID PRIMARY KEY,
                userID UUID REFERENCES users(userID),
                name TEXT NOT NULL,
                createdAt TIMESTAMP NOT NULL,
                updatedAt TIMESTAMP NOT NULL
            );
        """)
        CURSOR.execute("""
            CREATE TABLE IF NOT EXISTS responses (
                responseID UUID PRIMARY KEY,
                sessionID UUID REFERENCES sessions(sessionID),
                prompt TEXT NOT NULL,
                response TEXT NOT NULL,
                timestamp TIMESTAMP NOT NULL
            );
        """)
        CURSOR.execute("""
            CREATE TABLE IF NOT EXISTS citations (
                responseID UUID REFERENCES responses(responseID),
                documentName TEXT NOT NULL,
                pageLabels TEXT NOT NULL,
                pdfPages TEXT NOT NULL
            );
        """)
        CONNECTION.commit()
    except psycopg.Error:
        logger.exception(f"Error setting up databases")
        CONNECTION.rollback()


def create_user(userID: str|UUID, username: str, hashed_password: str):
    try:
        CURSOR.execute(
            "INSERT INTO users (userID, username, hashedPassword) VALUES (%s, %s, %s)",
            (str(userID), username, hashed_password)
        )
        CONNECTION.commit()
        logger.info(f"User '{username}' with ID '{userID}' added successfully.")
    except psycopg.Error:
        logger.exception(f"Error adding user '{username}' with ID '{userID}'")
        CONNECTION.rollback()


def new_session(session_id: str, user_id: str, name: str, date_time: str|None = None) -> None:
    date_time = datetime.now().isoformat() if date_time is None else date_time
    try:
        CURSOR.execute(
            """
                INSERT INTO sessions (sessionID, userID, name, createdAt, updatedAt) 
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (sessionID) DO NOTHING
            """,
            (session_id, user_id, name, date_time, date_time)
        )
        CONNECTION.commit()
        logger.info(f"Session \'{name}\' with ID \'{session_id}\' added successfully.")
    except psycopg.Error:
        logger.exception(f"Error adding session \'{name}\' with ID \'{session_id}\'")


def delete_session(session_id: str) -> None:
    try:
        CURSOR.execute(
            """
                DELETE FROM citations c USING responses r
                WHERE c.responseID = r.responseID AND r.sessionID = %s
            """, 
            (session_id,)
        )
        CURSOR.execute("DELETE FROM responses WHERE sessionID = %s", (session_id,))
        CURSOR.execute("DELETE FROM sessions WHERE sessionID = %s", (session_id,))
        CONNECTION.commit()
        logger.info(f"Session with ID \'{session_id}\' deleted successfully.")
    except psycopg.Error:
        logger.exception(f"Error deleting session with ID \'{session_id}\'")
        CONNECTION.rollback()
    

def get_sessions(user_id: str) -> list[dict]:
    try:
        CURSOR.execute(
            "SELECT sessionID, name, createdAt, updatedAt FROM sessions WHERE userID = %s ORDER BY updatedAt DESC",
            (user_id,)
        )
        sessions = CURSOR.fetchall()
        return sessions
    except psycopg.Error:
        logger.exception("Error fetching sessions")
        return []


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
        logger.info(f"Response with ID \'{response_id}\' added successfully.")
    except psycopg.Error:
        logger.exception(f"Error adding response with ID \'{response_id}\'")


def new_citation(response_id: str, document_name: str, page_labels: str, pdf_pages: str) -> None:
    try:
        CURSOR.execute(
            "INSERT INTO citations (responseID, documentName, pageLabels, pdfPages) VALUES (%s, %s, %s, %s)",
            (response_id, document_name, page_labels, pdf_pages)
        )
        CONNECTION.commit()
        logger.info(f"Citation for response ID \'{response_id}\' added successfully.")
    except psycopg.Error:
        logger.exception(f"Citation for response ID \'{response_id}\' already exists.")


def fetch_user(username: str) -> UserInDB|None:
    try:
        data = CURSOR.execute(
            "SELECT userID, username, hashedPassword FROM users WHERE username = %s",
            (username,)
        ).fetchone()
        if data:
            return UserInDB(
                userID=str(data['userid']),
                username=data['username'],
                hashed_password=data['hashedpassword']
            )
    except psycopg.Error:
        logger.exception("Error fetching user")
        return None


def get_chat(session_id: str) -> list[dict]:
    try:
        responses = CURSOR.execute(
            """
            SELECT
                r.prompt,
                r.response,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'documentName', c.documentName,
                            'pageLabels', c.pageLabels,
                            'pdfPages', c.pdfPages
                        )
                    ) FILTER (WHERE c.responseID IS NOT NULL), '[]'
                ) as citations
            FROM responses r
            LEFT JOIN citations c
                ON r.responseID = c.responseID
            WHERE r.sessionID = %s
            GROUP BY r.responseID
            ORDER BY r.timestamp ASC
            """,
            (session_id,)
        ).fetchall()

        return responses
    except psycopg.Error:
        logger.exception("Error fetching chat")