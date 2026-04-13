import os
from psycopg.rows import dict_row
import psycopg

# db_uri = 'postgresql://postgres:admin125@localhost:5435/postgres?sslmode=disable'
db_uri = 'postgresql://{user}:{password}@postgres:5432/postgres?sslmode=disable'.format(
    user=os.environ['POSTGRES_USER'],
    password=os.environ['POSTGRES_PASSWORD'],
)
CONNECTION = psycopg.connect(db_uri, row_factory=dict_row)
CURSOR = CONNECTION.cursor()