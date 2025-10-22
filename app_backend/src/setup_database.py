from pymilvus import MilvusClient
import os
from argparse import ArgumentParser
from dotenv import load_dotenv, get_key
from time import time

from vectorDB import chatbot_pipeline
from pdf import dbx_handler

load_dotenv()

def setup_database(
        path: str,
        db_name: str,
        recreate: bool = False
    ):

    MILVUS_HOST = get_key("../.env", "MILVUS_HOST")
    MILVUS_PORT = get_key("../.env", "MILVUS_PORT")

    db_uri = f'http://{MILVUS_HOST}:{MILVUS_PORT}'

    client = MilvusClient(
        uri=db_uri,
        db_name=db_name
    )

    print(client.list_databases())
    for collection in client.list_collections():
        print(len(collection))


    if recreate:
        print(f'Recreating database: {db_name}')
        for collection in client.list_collections():
            client.drop_collection(collection)

        if db_name in client.list_databases():
            client.drop_database(db_name)

    if db_name not in client.list_databases():
        print(f'Creating database: {db_name}')
        client.create_database(db_name)


    dbx = dbx_handler()
    vector_db = chatbot_pipeline(
        vector_db_name=db_name,
        db_uri=db_uri,
    )

    if len(path) == 0:
        path = ['/wip_lo']
    for p in path:
        if p.endswith('.pdf'):
            files = [p]
        else:
            if not 'wip_lo' in p:
                p = f'/wip_lo/{p}'
            files = dbx.list_files(folder=p)

        for file in files:
            start_time = time()
            print(f'Processing file: {file if isinstance(file, str) else file.name}')
            metadata, pdf_bytes = dbx.download_file_to_memory(file)

            vector_db.fill_vector_store(
                document=pdf_bytes,
                name=metadata.name
            )

            print(f'File {metadata.name} processed in {time() - start_time:.2f} seconds.')

    for collection in client.list_collections():
        print(f'Collection {collection} has {len(collection)} vectors.')


if __name__ == "__main__":
    parser = ArgumentParser(description="Setup the vector database with PDF documents from Dropbox.")
    
    parser.add_argument(
        'path', type=str, nargs='*', default='', help='Folder/file path in Dropbox to scan for PDF documents'
    )
    parser.add_argument(
        '-n', '--name', type=str, default='document_embeddings', help='Name of the Milvus database to use'
    )
    parser.add_argument(
        '--recreate', action='store_true', help='Recreate the database if it already exists'
    )

    args = parser.parse_args()

    setup_database(
        args.path,
        args.name,
        args.recreate
    )
