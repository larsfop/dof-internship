import psycopg
from psycopg import Cursor
from psycopg.rows import dict_row, RowMaker
import json
import os
from datetime import datetime
from uuid import uuid4, UUID
from typing import Any, Sequence
import logging
from langchain_openai.embeddings import OpenAIEmbeddings

from pydantic_classes import UserInDB, ResponseOutput

# db_uri = 'postgresql://postgres:admin125@localhost:5435/postgres?sslmode=disable'
db_uri = 'postgresql://{user}:{password}@postgres:5432/postgres?sslmode=disable'.format(
    user=os.environ['POSTGRES_USER'],
    password=os.environ['POSTGRES_PASSWORD'],
)
CONNECTION = psycopg.connect(db_uri, row_factory=dict_row)
CURSOR = CONNECTION.cursor()
embed_model = OpenAIEmbeddings(model='text-embedding-3-small')

logger = logging.getLogger('main')

def setup_databases() -> None:
    try:
        # Prepare vector extension
        CURSOR.execute("CREATE EXTENSION IF NOT EXISTS vector;")

        # Prepare chat history tables and indexes
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
                createdAt TIMESTAMP DEFAULT now(),
                updatedAt TIMESTAMP DEFAULT now()
            );
        """)
        CURSOR.execute("""
            CREATE TABLE IF NOT EXISTS responses (
                responseID UUID PRIMARY KEY,
                sessionID UUID REFERENCES sessions(sessionID),
                prompt TEXT NOT NULL,
                response TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT now()
            );
        """)
        CURSOR.execute("""
            CREATE TABLE IF NOT EXISTS citations (
                id BIGSERIAL PRIMARY KEY,
                responseID UUID REFERENCES responses(responseID),
                documentName TEXT NOT NULL,
                pageLabels TEXT NOT NULL,
                pdfPages TEXT NOT NULL
            );
        """)
        CURSOR.execute("""
            CREATE INDEX IF NOT EXISTS idx_sessions_userID ON sessions(userID);
            CREATE INDEX IF NOT EXISTS idx_responses_sessionID ON responses(sessionID);
            CREATE INDEX IF NOT EXISTS idx_citations_responseID ON citations(responseID);
            """)
        
        # Prepare semantic cache table and index
        CURSOR.execute("""
            CREATE TABLE IF NOT EXISTS semantic_cache (
                id UUID PRIMARY KEY,
                prompt TEXT NOT NULL,
                response TEXT NOT NULL,
                summary_title TEXT NOT NULL,
                embedding VECTOR(1536) NOT NULL,
                timestamp TIMESTAMP DEFAULT now()
            );
        """)
        CURSOR.execute("""
            CREATE TABLE IF NOT EXISTS cache_citations (
                id BIGSERIAL PRIMARY KEY,
                cacheID UUID REFERENCES semantic_cache(id) NOT NULL,
                documentName TEXT NOT NULL,
                pageLabels TEXT NOT NULL,
                pdfPages TEXT NOT NULL
            );
        """)
        CURSOR.execute("""
            CREATE INDEX IF NOT EXISTS idx_semantic_cache_embedding 
            ON semantic_cache 
            USING ivfflat (embedding vector_cosine_ops) 
            WITH (lists = 100);
            CREATE INDEX IF NOT EXISTS idx_cache_citations_cacheID ON cache_citations(cacheID);
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
        CONNECTION.rollback()


def update_session_name(session_id: str, new_name: str) -> None:
    try:
        CURSOR.execute(
            "UPDATE sessions SET name = %s WHERE sessionID = %s",
            (new_name, session_id)
        )
        CONNECTION.commit()
        logger.info(f"Session with ID \'{session_id}\' renamed to \'{new_name}\' successfully.")
    except psycopg.Error:
        logger.exception(f"Error renaming session with ID \'{session_id}\' to \'{new_name}\'")
        CONNECTION.rollback()


def delete_session(session_id: str) -> None:
    try:
        CURSOR.execute(
            """
                DELETE FROM citations c USING responses r
                WHERE c.responseID = r.responseID AND r.sessionID = %s
            """, 
            (session_id, )
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
        CONNECTION.rollback()


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
        CONNECTION.rollback()


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
        CONNECTION.rollback()
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
        CONNECTION.rollback()

def new_semantic_cache_embedding(prompt: str, response: ResponseOutput) -> None:
    uuid_str = str(uuid4())
    prompt = prompt.lower()
    embeddings = embed_model.embed_query(prompt)
    try:
        CURSOR.execute(
            (
                "INSERT INTO semantic_cache "
                "(id, prompt, response, summary_title, embedding) "
                "VALUES (%s, %s, %s, %s, %s)"
            ),
            (uuid_str, prompt, response.response, response.summary_title, embeddings)
        )
        
        for citation in response.citations:
            CURSOR.execute(
                (
                    "INSERT INTO cache_citations "
                    "(cacheID, documentName, pageLabels, pdfPages) "
                    "VALUES (%s, %s, %s, %s)"
                ),
                (
                    uuid_str,
                    citation.document_name,
                    ';'.join(map(str, citation.page_labels)),
                    ';'.join(map(str, citation.pdf_page_indices))
                )
            )

        CONNECTION.commit()
        logger.info(f"Semantic cache entry added successfully.")
    except psycopg.Error:
        CONNECTION.rollback()
        logger.exception(f"Error adding semantic cache entry")


def fetch_from_semantic_cache(prompt: str) -> dict|None:
    embeddings = embed_model.embed_query(prompt.lower())
    try:
        data = CURSOR.execute(
            """
                SELECT s.response, s.summary_title,
                1 - (s.embedding <-> %s::vector) AS similarity_score,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'document_name', c.documentName,
                            'page_labels', c.pageLabels,
                            'pdf_page_indices', c.pdfPages
                        )
                    ) FILTER (WHERE c.cacheID IS NOT NULL), '[]'
                ) as citations
                FROM semantic_cache s
                LEFT JOIN cache_citations c
                    ON c.cacheID = s.id
                GROUP BY s.id
                ORDER BY similarity_score DESC
                LIMIT 1
            """,
            (embeddings, )
        ).fetchone()

        for citation in data['citations']:
            citation['page_labels'] = citation['page_labels'].split(';')
            citation['pdf_page_indices'] = list(map(int, citation['pdf_page_indices'].split(';')))

        return data
    except psycopg.Error:
        CONNECTION.rollback()
        logger.exception("Error fetching from semantic cache")