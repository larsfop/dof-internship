import os
import psycopg
from psycopg.rows import dict_row
import logging
from pathlib import Path

logger = logging.getLogger("main")

# db_uri = 'postgresql://postgres:admin125@localhost:5435/postgres?sslmode=disable'
db_uri = 'postgresql://{user}:{password}@postgres:5432/postgres?sslmode=disable'.format(
    user=os.environ['POSTGRES_USER'],
    password=os.environ['POSTGRES_PASSWORD'],
)
CONNECTION = psycopg.connect(db_uri, row_factory=dict_row)
CURSOR = CONNECTION.cursor()


logger.info("Setting up databases...")
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
            userID UUID,
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

    # Prepare pdf tables
    CURSOR.execute("""
        CREATE TABLE IF NOT EXISTS pdfs (
            id UUID PRIMARY KEY,
            documentName TEXT NOT NULL UNIQUE,
            documentPath TEXT NOT NULL,
            category TEXT
        );
    """)
    CONNECTION.commit()
    logger.info("Databases setup complete")
except psycopg.Error:
    logger.exception(f"Error setting up databases")
    CONNECTION.rollback()