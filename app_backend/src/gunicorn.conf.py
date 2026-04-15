bind = "0.0.0.0:8015"
workers = 1
worker_class = "uvicorn.workers.UvicornWorker"
pidfile = "../data/gunicorn.pid"

timeout = 300
loglevel = "info"
# reload = True
# reload_engine = 'poll'

def post_worker_init(worker):
    from main import app_process_all_pdfs
    app_process_all_pdfs()