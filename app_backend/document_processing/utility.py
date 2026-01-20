from pymupdf import Document
from numpy.typing import ArrayLike
import numpy as np
from pathlib import Path
import json
import yaml
from typing import List
from class_objects import DocumentPartition, PartitionConfig
import time


def load_config(config_path: Path|str) -> PartitionConfig:
    """Load YAML configuration file."""
    with open(config_path, 'r') as file:
        config = yaml.safe_load(file)
    
    return PartitionConfig(**config)


def crop_partitions(partitions: List[DocumentPartition], document: Document, crop: ArrayLike) -> List[DocumentPartition]:
    cropped_data = []
    for partition in partitions:
        page_number = partition.metadata.page_number - 1
        page = document[page_number]
        scale = partition.metadata.coordinates.layout_height / page.rect.height
        crop_scaled = crop * scale

        coordinates = np.array(partition.metadata.coordinates.points)
        if not (
            coordinates.max(axis=0)[0] <= crop_scaled[0] or
            coordinates.min(axis=0)[0] >= crop_scaled[2] or
            coordinates.min(axis=0)[1] <= crop_scaled[1] or
            coordinates.max(axis=0)[1] >= crop_scaled[3]
        ):
            cropped_data.append(partition)

    return cropped_data


def load_partitions(json_path: Path) -> list[DocumentPartition]:
    with open(json_path, 'r') as f:
        partitions_json = json.load(f)
    
    partitions = [DocumentPartition(**part) for part in partitions_json]
    return partitions


def write_to_file(data: list|dict, file_path: Path) -> None:
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)


def read_from_file(file_path: Path) -> list|dict:
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    return data


class Timer:
    def __init__(self, enter_msg: str = '', exit_msg: str = '') -> None:
        self.enter_msg = enter_msg
        self.exit_msg = exit_msg

    def __enter__(self):
        self.time = time.time()
        print(self.enter_msg)

        return self

    def __exit__(self, exec_type, exec_val, exec_tb):
        if self.exit_msg:
            print(self.exit_msg, f'- Time elapsed: {(time.time() - self.time):.2f}s')
        else:
            print(f'Time elapsed {(time.time() - self.time):.2f}s')



if __name__ == "__main__":
    with Timer('test', 'end'):
        time.sleep(0.5)