#!/usr/bin/env python3
# PYTHON_ARGCOMPLETE_OK
import os
from pathlib import Path
import argparse
import pymupdf
import numpy as np
import json
from langchain_core.documents import Document
import shutil
import logging

from .utility import load_partitions, crop_partitions, Timer, write_to_file, read_from_file
from .unstructured_read_pdf import chunk_pdf
from .partition_processing import process_partitions
from .vector_store import add_documents_to_vector_store, prepare_documents
from config import CONFIG, PartitionConfig

logger = logging.getLogger('main')

def chunk_and_store_document(
        file_path: Path, 
        is_partitioning: bool = True, 
        is_chunking: bool = True, 
        is_vector_storing: bool = True,
        load_checkpoint: bool = True
    ) -> None:
    filename = file_path.stem
    with Timer(
        f"Processing file: {filename}",
        f'Processing file {filename} successfully completed'
    ):
        # Load configuration
        config = CONFIG.partition
        output_path = Path(config.output_dir_path) / filename
        output_path.mkdir(parents=True, exist_ok=True)

        if is_partitioning:
            partition_document(
                file_path, 
                load_checkpoint, 
                filename, 
                config, 
                output_path
            )

        data = None
        with pymupdf.open(file_path) as doc:
            if is_chunking:
                data = chunk_partitions(
                    config, 
                    output_path, 
                    doc
                )

            # Fill vector store
            if is_vector_storing:
                store_chunks(
                    file_path, 
                    load_checkpoint, 
                    filename, 
                    output_path, 
                    data, 
                    doc
                )


def partition_document(
        file_path: Path, 
        load_checkpoint: bool, 
        filename: str, 
        config: PartitionConfig, 
        output_path: Path
    ) -> None:
    while True:
        if load_checkpoint:
            try:
                with open(output_path / f'unstructured_partitions_{config.strategy}.json', 'r') as f:
                    _ = json.load(f)
                logger.info(f"Loaded existing partitions for {filename}, skipping partitioning step.")

                break
            except FileNotFoundError:
                logger.info(f"No existing partitions found for {filename}, proceeding with partitioning.")

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


def chunk_partitions(
        config: PartitionConfig, 
        output_path: Path, 
        doc: pymupdf.Document
    ) -> list[dict]:
    with Timer(
        'Starting post-processing and chunking of partitions',
        'Finished processing and chunking partitions'
    ):
        partitions = load_partitions(output_path / f'unstructured_partitions_{config.strategy}.json')

        # Crop partitions
        crop = np.array(config.crop)
        partitions = crop_partitions(partitions, doc, crop)

        data = process_partitions(partitions, doc)

        try:
            shutil.copy2(output_path / 'document_chunks.json', output_path / 'document_chunks_backup.json')
        except FileNotFoundError:
            pass

        # Save or process `data` as needed
        write_to_file(data, output_path / 'document_chunks.json')
        logger.info(f"Created {len(data)} chunks.")
    return data


def store_chunks(
        file_path: Path, 
        load_checkpoint: bool, 
        filename: str, 
        output_path: Path, 
        data: list[dict], 
        doc: pymupdf.Document
    ) -> None:
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
                logger.info(f"No existing document vectors found for {filename}, proceeding to create them.")
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
            file_path,
            CONFIG.rag,
        )
        logger.info(f"Added {len(documents)} documents to the vector store.")

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