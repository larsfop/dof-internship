from pymupdf import Document
from numpy.typing import ArrayLike
import numpy as np
from pathlib import Path
import json
import yaml
from typing import List
from class_objects import DocumentPartition, PartitionConfig


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


if __name__ == "__main__":
    config = load_config(Path('../volumes/configs/partitionConfig.yaml'))
    print(config)