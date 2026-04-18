import os
import psycopg
from psycopg.rows import dict_row
import logging

logger = logging.getLogger("main")

def setup_database():
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

        CURSOR.execute("""
            CREATE TABLE IF NOT EXISTS users (
                user_id UUID PRIMARY KEY,
                import_code TEXT NOT NULL UNIQUE,
                last_active TIMESTAMP DEFAULT now()
            );
        """)

        # Prepare chat history tables and indexes
        CURSOR.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                session_id UUID PRIMARY KEY,
                user_id UUID REFERENCES users(user_id),
                name TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT now(),
                updated_at TIMESTAMP DEFAULT now()
            );
        """)
        CURSOR.execute("""
            CREATE TABLE IF NOT EXISTS responses (
                response_id UUID PRIMARY KEY,
                session_id UUID REFERENCES sessions(session_id),
                prompt TEXT NOT NULL,
                response TEXT NOT NULL,
                cache_id UUID REFERENCES semantic_cache(id) DEFAULT NULL,
                timestamp TIMESTAMP DEFAULT now()
            );
        """)
        CURSOR.execute("""
            CREATE TABLE IF NOT EXISTS citations (
                id BIGSERIAL PRIMARY KEY,
                response_id UUID REFERENCES responses(response_id),
                document_name TEXT NOT NULL,
                page_labels TEXT NOT NULL,
                page_indices TEXT NOT NULL
            );
        """)
        CURSOR.execute("""
            CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
            CREATE INDEX IF NOT EXISTS idx_responses_session_id ON responses(session_id);
            CREATE INDEX IF NOT EXISTS idx_citations_response_id ON citations(response_id);
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
                cache_id UUID REFERENCES semantic_cache(id) NOT NULL,
                document_name TEXT NOT NULL,
                page_labels TEXT NOT NULL,
                page_indices TEXT NOT NULL
            );
        """)
        CURSOR.execute("""
            CREATE INDEX IF NOT EXISTS idx_semantic_cache_embedding 
            ON semantic_cache 
            USING ivfflat (embedding vector_cosine_ops) 
            WITH (lists = 100);
            CREATE INDEX IF NOT EXISTS idx_cache_citations_cache_id ON cache_citations(cache_id);
        """)

        # Prepare pdf tables
        CURSOR.execute("""
            CREATE TABLE IF NOT EXISTS pdfs (
                id UUID PRIMARY KEY,
                document_name TEXT NOT NULL UNIQUE,
                document_path TEXT NOT NULL,
                category TEXT
            );
        """)
        CONNECTION.commit()
        logger.info("Databases setup complete")
    except psycopg.Error:
        logger.exception(f"Error setting up databases")
        CONNECTION.rollback()