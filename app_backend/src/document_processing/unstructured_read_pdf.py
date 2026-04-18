from unstructured.partition.pdf import partition_pdf
from unstructured.staging.base import elements_to_dicts
import json
from pathlib import Path


def chunk_pdf(
        file_path: Path|str, 
        output_dir: Path,
        strategy: str = 'hi_res',
    ) -> None:

    file_path = Path(file_path)

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

    # Save partitions to JSON
    with open(output_dir / f"unstructured_partitions_{strategy}.json", 'w') as f:
        json.dump(elements_to_dicts(elements), f, indent=4)