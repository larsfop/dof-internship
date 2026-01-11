
import io
from contextlib import redirect_stdout, redirect_stderr

f = io.StringIO()

with redirect_stdout(f), redirect_stderr(f):
    from unstructured.partition.pdf import partition_pdf
    from unstructured.staging.base import elements_to_dicts
    from unstructured.documents.elements import Element
    import json
    from pathlib import Path
    import argparse
    from typing import Dict
    import numpy as np
    import yaml


def crop_elements(elements: list[Element], x0: float = 0, y0: float = 0, x1: float = np.inf, y1: float = np.inf):

    elements_dict = elements_to_dicts(elements)
    cropped_elements = []
    for element in elements_dict:
        coords = np.array(element['metadata']['coordinates']['points'])
        x_min, y_min = coords.min(axis=0)
        x_max, y_max = coords.max(axis=0)

        if x_max <= x0 or x_min >= x1 or y_max <= y0 or y_min >= y1:
            continue

        cropped_elements.append(element)

    return cropped_elements


def chunk_pdf(
        file_path: Path|str, 
        output_dir: Path,
        strategy: str = 'hi_res',
    ) -> None:

    print(f"Processing file: {file_path.name} with strategy: {strategy}")

    file_path = Path(file_path)
    output_dir /= file_path.stem

    output_dir.mkdir(exist_ok=True, parents=True)

    # Partition the cropped PDF with high-res image and table extraction
    elements = partition_pdf(
        filename=file_path,
        strategy=strategy,
        extract_images_in_pdf=True,
        extract_image_block_types=['image', 'table'],
        extract_image_block_to_payload=False,
        extract_image_block_format='png',
        high_res_image=True,
        pdf_image_dpi=400,
    )

    # height = elements[0].metadata['coordinates']['layout_height']

    # Save partitions to JSON
    with open(output_dir / f"unstructured_partitions_{strategy}.json", 'w') as f:
        json.dump(elements_to_dicts(elements), f, indent=4)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Partition a PDF file and save the output as JSON.")
    parser.add_argument("filename", type=str, help="Path to the input PDF file.")
    parser.add_argument('-s', '--strategy', type=str, default='hi_res', help="Partitioning strategy: 'fast' or 'hi_res'.")
    parser.add_argument("--output_dir", type=Path, default=Path('../volumes/data/partitions/'), help="Directory to save the output JSON file.")

    args = parser.parse_args()

    file_path = Path('../../pdfs/') / args.filename

    chunk_pdf(
        file_path,
        args.output_dir,
        strategy=args.strategy
    )