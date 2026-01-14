import numpy as np
import json
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any, Iterator, Optional, Self
from pymupdf import Document


class BaseDataClass:
    def __iter__(self) -> Iterator[tuple[str, Any]]:
        return iter(self.__dict__.items())

    def get(self, key: str, default: Optional[object] = None) -> Optional[object]:
        return getattr(self, key, default)

    def keys(self) -> list[str]:
        return list(self.__dict__.keys())
    
    def values(self) -> list[object]:
        return list(self.__dict__.values())
    
    def items(self) -> list[tuple[str, object]]:
        return list(self.__dict__.items())
    

@dataclass
class DocumentCoordinates(BaseDataClass):
    layout_height: int
    layout_width: int
    points: list[tuple[float, float]]
    system: str

    def get_scaled_coordinates(self, x_scale: float, y_scale: float) -> list[tuple[float, float]]:
        scaled_points = [
            [x * x_scale, y * y_scale] for x, y in self.points
        ]

        return scaled_points


@dataclass
class DocumentMetadata(BaseDataClass):
    coordinates: DocumentCoordinates
    filename: str
    filetype: str
    languages: list[str]
    last_modified: str
    page_number: int
    parent_id: Optional[str] = None
    detection_class_prob: Optional[float] = -999
    image_path: Optional[str] = None
    file_directory: Optional[str] = None

    def __post_init__(self):
        self.coordinates = DocumentCoordinates(**self.coordinates)
    

@dataclass
class DocumentPartition(BaseDataClass):
    element_id: str
    metadata: DocumentMetadata = field(default_factory=DocumentMetadata)
    text: str = ''
    type: str = ''

    def __post_init__(self):
        self.metadata = DocumentMetadata(**self.metadata)


    def get_rect(self) -> np.ndarray:
        """
        Returns the bounding rectangle of the document partition in pixels as [x0, y0], [x1, y1].

        Returns:
            rect (list): The bounding rectangle coordinates.
        """
        coords = np.array(self.metadata.coordinates.points)
        top_left = coords.min(axis=0)
        bottom_right = coords.max(axis=0)

        return np.array([top_left, bottom_right])
    

    def get_proba_score(self) -> float:
        return self.metadata.detection_class_prob
    

@dataclass
class PartitionConfig:
    pdf_dir_path: str
    output_dir_path: str

    strategy: str
    crop: list[float]

    embedding_model: str
    embedding_dimension: int
    distance_metric: str
    collection_name: str

    def get(self, key: str, default: Optional[object] = None) -> Optional[object]:
        return getattr(self, key, default)