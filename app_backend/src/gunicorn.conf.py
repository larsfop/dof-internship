bind = "0.0.0.0:8015"
workers = 1
worker_class = "uvicorn.workers.UvicornWorker"
pidfile = "gunicorn.pid"

timeout = 300
loglevel = "info"
# reload = True
# reload_engine = 'poll'