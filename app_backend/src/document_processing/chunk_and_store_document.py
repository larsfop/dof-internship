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

logger = logging.getLogger("document_processing")

def chunk_and_store_document(
        file_path: Path, 
        is_partitioning: bool = True, 
        is_chunking: bool = True, 
        is_vector_storing: bool = True,
        load_checkpoint: bool = True
    ) -> bool:
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
                    doc,
                    load_checkpoint
                )

            # Fill vector store
            if is_vector_storing:
                token_quota_reached = store_chunks(
                    file_path, 
                    load_checkpoint, 
                    filename, 
                    output_path, 
                    data, 
                    doc
                )

    return token_quota_reached


def partition_document(
        file_path: Path, 
        load_checkpoint: bool, 
        filename: str, 
        config: PartitionConfig, 
        output_path: Path
    ) -> None:
    if load_checkpoint:
        try:
            if (output_path / f'unstructured_partitions_{config.strategy}.json').is_file():
                logger.info(f"Loaded existing partitions for {filename}, skipping partitioning step.")
                return
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


def chunk_partitions(
        config: PartitionConfig, 
        output_path: Path, 
        doc: pymupdf.Document,
        load_checkpoint: bool
    ) -> list[dict]:
    with Timer(
        'Starting post-processing and chunking of partitions',
        'Finished processing and chunking partitions'
    ):
        if load_checkpoint:
            try:
                data: list[dict] = read_from_file(output_path / 'document_chunks.json')
                logger.info(f"Loaded existing chunks for {output_path.stem}, skipping chunking step.")
                return data
            except FileNotFoundError:
                logger.info(f"No existing chunks found for {output_path.stem}, proceeding with chunking.")
        
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
        new_documents, token_quota_reached = prepare_documents(
            data,
            doc,
            start_index=len(documents)
        )
        documents.extend(new_documents)

        if token_quota_reached:
            return True

        # Load documents into vector store
        add_documents_to_vector_store(
            documents,
            file_path,
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

        return False