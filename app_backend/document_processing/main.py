#!/usr/bin/env python3
# PYTHON_ARGCOMPLETE_OK
import os
from pathlib import Path
import argparse
import argcomplete
from argcomplete.completers import BaseCompleter, FilesCompleter, DirectoriesCompleter, ChoicesCompleter, EnvironCompleter
import pymupdf
import numpy as np
import json
from langchain_core.documents import Document
import shutil

from utility import load_config, load_partitions, crop_partitions, Timer, write_to_file, read_from_file
from unstructured_read_pdf import chunk_pdf
from partition_processing import process_partitions
from vector_store import add_documents_to_vector_store, prepare_documents


def main(
        file_path: Path, 
        is_partitioning: bool, 
        is_chunking: bool, 
        is_vector_storing: bool,
        load_checkpoint: bool = False
    ) -> None:
    filename = file_path.stem
    with Timer(
        f"Processing file: {filename}",
        f'Processing file {filename} successfully completed'
    ):
        config_path = Path(os.environ.get('CONFIG_PATH', '../volumes/data/configs/'))

        # Load configuration
        config = load_config(config_path / 'partitionConfig.yaml')
        output_path = Path(config.output_dir_path) / filename
        output_path.mkdir(parents=True, exist_ok=True)

        # Process partitions using the Unstructured library
        if is_partitioning:
            while True:
                if load_checkpoint:
                    try:
                        with open(output_path / f'unstructured_partitions_{config.strategy}.json', 'r') as f:
                            _ = json.load(f)
                        print(f"Loaded existing partitions for {filename}, skipping partitioning step.")

                        break
                    except FileNotFoundError:
                        print(f"No existing partitions found for {filename}, proceeding with partitioning.")

                try:
                    shutil.copy2(output_path / f'unstructured_partitions_{config.strategy}.json', output_path / f'unstructured_partitions_{config.strategy}_backup.json')
                except FileNotFoundError:
                    pass

                with Timer(exit_msg='Finished partitioning PDF'):
                    chunk_pdf(
                        file_path=file_path,
                        output_dir=output_path,
                        strategy=config.strategy
                    )

                break

        data = None
        with pymupdf.open(file_path) as doc:
            # Chunk partitions for vector storage
            if is_chunking:
                with Timer(
                    'Starting post-processing and chunking of partitions',
                    'Finished processing and chunking partitions'
                ):
                    partitions = load_partitions(output_path / f'unstructured_partitions_{config.strategy}.json')

                    # Crop partitions
                    crop = np.array(config.crop)
                    partitions = crop_partitions(partitions, doc, crop)

                    start_page = config.get('start_page', 1)
                    end_page = config.get('end_page', doc.page_count)

                    data = process_partitions(partitions, doc, start_page, end_page)

                    try:
                        shutil.copy2(output_path / 'document_chunks.json', output_path / 'document_chunks_backup.json')
                    except FileNotFoundError:
                        pass

                    # Save or process `data` as needed
                    write_to_file(data, output_path / 'document_chunks.json')
                    print(f"Created {len(data)} chunks from pages {start_page} to {end_page}.")

            # Fill vector store
            if is_vector_storing:
                with Timer('Filling vector store with document chunks'):
                    if not data:
                        data: list[dict] = read_from_file(output_path / 'document_chunks.json')

                    if load_checkpoint:
                        try:
                            json_data = read_from_file(output_path / 'document_vectors.json')
                            documents: list[Document] = [
                                Document(
                                    chunk['content'],
                                    metadata=chunk['metadata']
                                ) for chunk in json_data
                            ]
                        except FileNotFoundError:
                            print(f"No existing document vectors found for {filename}, proceeding to create them.")
                            documents: list[Document] = []
                    else:
                        documents: list[Document] = []

                    # Prepare documents for loading into vector store
                    documents.extend(prepare_documents(
                        data, 
                        doc, 
                        start_index=len(documents)
                    ))

                    # Load documents into vector store
                    add_documents_to_vector_store(
                        documents,
                        filename,
                        config,
                    )
                    print(f"Added {len(documents)} documents to the vector store.")

                    # Save document vectors to file as checkpoint
                    output = [
                        {'content': d.page_content, 'metadata': d.metadata}
                        for d in documents
                    ]

                    try:
                        shutil.copy2(output_path / 'document_vectors.json', output_path / 'document_vectors_backup.json')
                    except FileNotFoundError:
                        pass

                    write_to_file(output, output_path / 'document_vectors.json')


if __name__ == "__main__":
    config = load_config(Path(os.environ.get('CONFIG_PATH', '../volumes/data/configs/')) / 'partitionConfig.yaml')
    pdf_dir = Path(config.pdf_dir_path)

    parser = argparse.ArgumentParser(description="Process document partitions based on configuration.")
    args = parser.add_argument(
        'filenames', type=str, nargs='*', help="List of filenames to process. Can be partial names. Default: all PDFs in the specified directory."
    ).completer = FilesCompleter(allowednames=('.pdf',))
    parser.add_argument(
        '-p', action='store_true', help="Process all PDFs in the specified directory."
    )
    parser.add_argument(
        '-c', action='store_true', help='Post-processing and chunking'
    )
    parser.add_argument(
        '-d', action='store_true', help='Fill vector store'
    )
    parser.add_argument(
        '--input_dir', type=Path, default=None, help="Directory containing PDF files to process. If empty, uses the directory from the config file."
    )
    parser.add_argument(
        '-cp', '--load_checkpoint', action='store_true', help="Load existing vector store checkpoint if available. Default: False"
    )

    argcomplete.autocomplete(parser)
    args = parser.parse_args()

    input_dir = Path(args.input_dir) if args.input_dir else pdf_dir
    print(f"Using input directory: {input_dir}")

    files = set()
    print(args.filenames)
    if not args.filenames:
        files.update(input_dir.rglob('*.pdf'))
    for filename in args.filenames:
        files.update(input_dir.glob(f'*{filename}*.pdf'))

    print(files)

    flag_enabled = not (args.p or args.c or args.d)
    is_partitioning = True if flag_enabled else args.p
    is_chunking = True if flag_enabled else args.c
    is_vector_storing = True if flag_enabled else args.d

    for file_path in files:
        main(file_path, is_partitioning, is_chunking, is_vector_storing, args.load_checkpoint)