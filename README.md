# DOF PDF Assistant

A RAG-based (Retrieval-Augmented Generation) desktop application for querying engineering PDF documents. It combines a Tauri/React frontend with a Python FastAPI backend, a PostgreSQL vector database, and OpenAI language models.

---

## Architecture

```
app/               Tauri + React + TypeScript desktop application
app_backend/       Python FastAPI backend (Docker)
server_scripts/    PowerShell management scripts
pdfs/              Source PDF documents
```

### Frontend (`app/`)

- **Tauri** desktop shell (Rust)
- **React + TypeScript** UI built with Vite
- Split-pane layout: chat interface on the left, inline PDF viewer (PDF.js) on the right
- Streams AI responses via SSE (`text/event-stream`)
- Chat history persisted per user session

### Backend (`app_backend/`)

- **FastAPI** REST API served by Gunicorn/Uvicorn
- **LangGraph** agentic RAG pipeline with:
  - Semantic cache (skips LLM calls for repeated queries)
  - Document retrieval from a pgvector store
  - Answer generation with citations
  - Running conversation summary (via `langmem`)
- **PostgreSQL + pgvector** for vector storage and chat history
- **pgAdmin** for database management
- PDF processing pipeline: partition → chunk → embed → store

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Node.js](https://nodejs.org/) ≥ 18 and [pnpm](https://pnpm.io/) (for frontend development)
- [Rust](https://www.rust-lang.org/tools/install) (for Tauri)
- [Python](https://www.python.org/) ≥ 3.11, < 3.12 (for local scripts)
- An **OpenAI API key**

---

## Setup

### 1. Environment variables

Create a `.env` file in `app_backend/` (next to `docker-compose.yml`):

```env
OPENAI_API_KEY=sk-...
POSTGRES_USER=your_user
POSTGRES_PASSWORD=your_password
MOUNT_PATH=/app/documents
```

### 2. Start the backend

```powershell
cd app_backend
docker compose up -d --build
```

Services started:

| Service    | URL                          |
|------------|------------------------------|
| FastAPI    | http://localhost:8015/docs   |
| pgAdmin    | http://localhost:8080        |
| PostgreSQL | localhost:5435               |

### 3. Run the desktop app (development)

```powershell
cd app
pnpm install
pnpm tauri dev
```

---

## Adding Documents

Mount a local directory of PDFs into the container by running:

```powershell
# Requires administrator privileges
.\app_backend\add-document-mount.exe -sourcePath "C:\path\to\pdfs" -targetPath "my_documents"
```

Then reload the container:

```powershell
.\app_backend\reload-docker.exe
```

Process the newly mounted PDFs:

```powershell
# Process all PDFs
.\app_backend\process-all-pdfs.exe

# Process a single PDF
.\app_backend\process-pdfs.exe -FileName "document.pdf"
```

Remove a document from the vector store:

```powershell
.\app_backend\remove_pdfs.exe -FileName "document.pdf"
```

---

## Server Scripts

The `server_scripts/` folder contains PowerShell scripts for managing the backend. Pre-compiled `.exe` versions are located in `app_backend/`.

| Script / EXE               | Description                                              |
|----------------------------|----------------------------------------------------------|
| `add-document-mount`       | Adds a bind mount to `docker-compose.yml` *(requires admin)* |
| `reload-docker`            | Rebuilds and restarts the Docker containers              |
| `process-all-pdfs`         | Triggers processing of all configured PDFs               |
| `process-pdfs`             | Triggers processing of a single PDF by filename          |
| `remove_pdfs`              | Removes a PDF from the vector store                      |
| `parse_logs`               | Opens structured logs with `lnav`                        |

### Building EXEs from scripts

Requires [PS2EXE](https://github.com/MScholtes/PS2EXE) (`Install-Module ps2exe`):

```powershell
.\build_scripts.ps1
```

---

## PDF Processing Pipeline

1. **Partition** — splits the PDF into structural elements using `unstructured` (with Tesseract OCR)
2. **Chunk** — groups elements into semantically coherent chunks
3. **Embed** — generates embeddings via OpenAI (`text-embedding-*`)
4. **Store** — inserts vectors into PostgreSQL (pgvector)

Checkpointing is supported so interrupted runs can be resumed.

---

## Project Structure

```
app/
  src/
    layout/          Chat UI, PDF viewer, input/output blocks
    sidebar/         Document and session navigation
    context/         React context (refs, state)
    history/         Chat history components
app_backend/
  src/
    RAG/             LangGraph pipeline, response generation
    document_processing/  Partition, chunk, embed, store
    ai_models/       LangChain model wrappers
    database/        PostgreSQL queries (sessions, PDFs, cache)
    config/          TOML config loader with live-reload
server_scripts/      PowerShell management scripts
build_scripts.ps1    Compiles server_scripts/*.ps1 → app_backend/*.exe
```
