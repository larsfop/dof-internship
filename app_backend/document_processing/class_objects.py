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
    


class DocumentData:
    def __init__(self, *data: DocumentPartition, json_path: Path|None = None) -> None:
        self.data: list[DocumentPartition] = list(data)
        self.score: np.ndarray = np.array(
            [element.metadata.get('detection_class_prob', -999) for element in self.data]
        )
        self.type: np.ndarray[str] = np.array([element.get('type', None) for element in self.data], dtype=str)

        # Load data from JSON file
        if json_path is not None:
            self.from_json(json_path)


    def append(self, arg: dict) -> None:
        new_data: DocumentPartition = DocumentPartition(**arg)
        self.data.append(new_data)
        self.score = np.append(self.score, new_data.metadata.get('detection_class_prob', -999))
        self.type = np.append(self.type, new_data.get('type', None))


    def extend(self, *args: dict) -> None:
        new_data: list[DocumentPartition] = [DocumentPartition(**arg) for arg in args]
        self.data.extend(new_data)
        self.score = np.concatenate(
            (self.score, np.array([arg.metadata.get('detection_class_prob', -999) for arg in new_data]))
        )
        self.type = np.concatenate(
            (self.type, np.array([arg.get('type', None) for arg in new_data], dtype=str))
        )


    def from_json(self, filename: str) -> None:
        with open(filename, 'r') as f:
            json_data = json.load(f)

        self.extend(*json_data)


    def __repr__(self):
        return f'{self.__class__.__name__}(data={self.data})'


    def __getitem__(self, index: int) -> DocumentPartition:
        return self.data[index]


    def __setitem__(self, index: int, value: DocumentPartition) -> None:
        self.data[index] = DocumentPartition(**value)


    def __len__(self) -> int:
        return len(self.data)
    

    def __iter__(self):
        return iter(self.data)
    

    def where(self, condition: np.ndarray[bool]) -> Self:
        filtered_data = [self.data[i] for i in range(len(self.data)) if condition[i]]
        return DocumentData(*filtered_data)
    
    
    def get_types(self) -> dict[str, int]:
        types, counts = np.unique(self.type, return_counts=True)
        return {str(t): int(c) for t, c in zip(types, counts)}
    

    def mean(self, data_type: str = None) -> float:
        if data_type not in (None, *self.type):
            raise ValueError(f"data_type '{data_type}' not found in DocumentData types.\n"
                             f"Available types: {np.unique(self.type).tolist()}")
        scores = self.score
        if data_type is not None:
            scores = scores[self.type == data_type]

        return float(np.mean(scores, where=scores != -999))


    def crop_documents(self, document: Document, crop: np.ndarray) -> None:
        cropped_data = []
        for partition in self.data:
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

        self.data = cropped_data
            

    def to_dict(self) -> list[dict]:
        return [asdict(doc) for doc in self.data]


    def to_json(self, filename: str = None) -> list[dict]:
        data = self.to_dict()
        with open(filename, 'w') as f:
            json.dump(data, f, indent=4)

        return data


    def page_iterator(self, start: int = 1, end: int = -1) -> Iterator[Self]:
        end = self.data[-1].metadata.page_number if end == -1 else end
        for page_number in range(start, end + 1):
            page_elements = [element for element in self.data if element.metadata.page_number == page_number]
            yield DocumentData(*page_elements)
        