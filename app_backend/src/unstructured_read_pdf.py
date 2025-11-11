
import io
from contextlib import redirect_stdout, redirect_stderr

f = io.StringIO()

with redirect_stdout(f), redirect_stderr(f):
    from unstructured.partition.pdf import partition_pdf
    from unstructured.staging.base import elements_to_dicts
    from unstructured.documents.elements import Element
    import pymupdf
    import json
    from pathlib import Path
    import argparse
    from typing import Dict
    import numpy as np
    import io

    from pdf import dbx_handler


def crop_elements(elements: list[Element], x0: float = 0, y0: float = 0, x1: float = np.inf, y1: float = np.inf) -> Dict:

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
        filename: str, 
        output_dir: Path,
        is_dbx: bool = True,
        path_dir: Path|None = None
    ) -> None:


    path_dir = Path(path_dir) if path_dir else Path.cwd()
    tmp_dir = path_dir / 'tmp'
    tmp_dir.mkdir(exist_ok=True)

    output_dir = path_dir / output_dir
    output_dir.mkdir(exist_ok=True, parents=True)

    if not (tmp_dir / filename).exists():
        # Download the PDF from Dropbox if needed
        if is_dbx:
            dbx = dbx_handler()
            doc = dbx.get_pdf_document(filename)
        else:
            doc = pymupdf.open(filename)

        # Create a temporary directory to store the cropped PDF
        doc.save(tmp_dir / filename)

    # Partition the cropped PDF with high-res image and table extraction
    elements = partition_pdf(
        filename=tmp_dir / filename,
        # file=io.BytesIO(doc.write()),
        strategy='hi_res',
        extract_images_in_pdf=True,
        extract_image_block_types=['image', 'table'],
        extract_image_block_to_payload=False,
        extract_image_block_output_dir='./test_images',
        extract_image_block_format='png',
        high_res_image=True,
        pdf_image_dpi=400,
    )

    # Crop and save partitions to JSON
    with open(output_dir / f"{Path(filename).stem}_elements.json", 'w') as f:
        json.dump(elements_to_dicts(elements, 140, 280), f, indent=4)


if __name__ == "__main__":
    

    parser = argparse.ArgumentParser(description="Partition a PDF file and save the output as JSON.")
    parser.add_argument("filename", type=str, help="Path to the input PDF file.")
    parser.add_argument("output_dir", type=Path, help="Directory to save the output JSON file.")
    parser.add_argument("--dbx", action="store_false", help="Indicates if the file is in Dropbox. Default: True.")
    parser.add_argument("--path_dir", type=Path, default=None, help="Temporary directory for processing.")

    args = parser.parse_args()

    chunk_pdf(
        args.filename,
        args.output_dir,
        args.dbx,
        args.path_dir
    )