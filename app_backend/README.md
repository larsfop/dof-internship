# DOF SERVER BACKEND

## Admin links

Link to backend:

http://localhost:8015/docs

Link to postgres database admin PG-Admin:

http://localhost:8080

## Server Scripts

| Script | Description |
|---|---|
| `add-document-mount.exe` | Adds a new bind mount entry to the Docker Compose file, mapping a host source directory into the container's document path. Run `reload-docker.exe` afterwards to apply the change. |
| `process-all-pdfs.exe` | Triggers the backend to process all PDFs via the `/process_all_pdfs` endpoint. Supports flags to control partitioning, chunking, vector storing, checkpoint loading, and recreation. |
| `process-pdfs.exe` | Triggers processing of a single PDF (by filename) via the `/store_pdfs` endpoint. Accepts the same processing flags as `process-all-pdfs.exe`. |
| `reload-docker.exe` | Rebuilds and restarts the Docker Compose stack from the installed `docker-compose.yml`. |
| `remove-pdfs.exe` | Removes a single PDF (by filename) from the backend via the `/remove_pdf` endpoint. |

If `reload-docker.exe` does not work, run this
```
docker compose -f "dockerFile" up -d --build
```
Where the 