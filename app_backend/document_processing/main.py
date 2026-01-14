#!/usr/bin/env python3
# PYTHON_ARGCOMPLETE_OK
import os
from pathlib import Path
from time import time
import argparse
import argcomplete
from argcomplete.completers import BaseCompleter, FilesCompleter, DirectoriesCompleter, ChoicesCompleter, EnvironCompleter
import pymupdf
import numpy as np
import json

from unstructured_read_pdf import chunk_pdf
from partition_processing import process_partitions
from vector_store import add_documents_to_vector_store
from utility import load_config, load_partitions, crop_partitions


def main(filename: str, is_partitioning: bool, is_chunking: bool, is_vector_storing: bool) -> None:
    print(f"Processing file: {filename}")
    config_path = Path(os.environ.get('CONFIG_PATH', '../volumes/configs/'))

    # Load configuration
    config = load_config(config_path / 'partitionConfig.yaml')
    pdf_path = Path(config.pdf_dir_path)
    output_path = Path(config.output_dir_path) / filename
    output_path.mkdir(parents=True, exist_ok=True)

    # Process partitions using the Unstructured library
    if is_partitioning:
        chunk_pdf(
            file_path=pdf_path / f'{filename}.pdf',
            output_dir=output_path,
            strategy=config.strategy
        )

        print('Finished partitioning PDF')

    # Chunk partitions for vector storage
    data = None
    if is_chunking:
        print('Starting post-processing and chunking of partitions')
        with pymupdf.open(pdf_path / f'{filename}.pdf') as doc:
            partitions = load_partitions(output_path / f'unstructured_partitions_{config.strategy}.json')

            # Crop partitions
            crop = np.array(config.crop)
            partitions = crop_partitions(partitions, doc, crop)

            start_page = config.get('start_page', 1)
            end_page = config.get('end_page', doc.page_count)

            data = process_partitions(partitions, doc, start_page, end_page)

            # Save or process `data` as needed
            with open(output_path / 'document_chunks.json', 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=4)
            print(f"Created {len(data)} chunks from pages {start_page} to {end_page}.")

        print('Finished processing and chunking partitions')

    # Fill vector store
    if is_vector_storing:
        print('Filling vector store with document chunks')
        if not data:
            with open(output_path / 'document_chunks.json', 'r', encoding='utf-8') as f:
                data = json.load(f)

        add_documents_to_vector_store(data, filename, config)

    print(f'Processing file {filename} successfully completed')

if __name__ == "__main__":
    script_dir = Path(__file__).parent
    config = load_config(Path(os.environ.get('CONFIG_PATH', '../volumes/configs/')) / 'partitionConfig.yaml')
    pdf_dir = Path(config.pdf_dir_path)

    parser = argparse.ArgumentParser(description="Process document partitions based on configuration.")
    arg = parser.add_argument(
        'filenames', type=str, nargs='*', help="List of filenames to process."
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

    argcomplete.autocomplete(parser)
    args = parser.parse_args()

    flag_enabled = not (args.p or args.c or args.d)
    is_partitioning = True if flag_enabled else args.p
    is_chunking = True if flag_enabled else args.c
    is_vector_storing = True if flag_enabled else args.d

    for filename in args.filenames:
        main(filename, is_partitioning, is_chunking, is_vector_storing)