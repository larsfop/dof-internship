import numpy as np
import tiktoken
import re
from typing import List, Any, Iterator
import pymupdf
import matplotlib.pyplot as plt
from pathlib import Path
import pymupdf
from unidecode import unidecode

from .class_objects import DocumentPartition

def extract_image(page: pymupdf.Page, coords: np.array) -> np.ndarray:
    coords[0,0] = 52
    coords[1,0] = 772

    rect = pymupdf.Rect(coords.tolist())
    pix = page.get_pixmap(dpi=400, clip=rect)

    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)

    return pix, img


def save_images(
    partition: DocumentPartition,
    data: list[dict],
    document: pymupdf.Document,
    output_dir: Path|str
) -> None:
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    coord_scale = document[0].rect.width / partition[0].metadata.coordinates.layout_width
    indices = {
        'image': 1,
        'table': 1,
        'formula': 1
    }
    for item in data:
        if item['type'] == 'text':
            continue
        
        img_type = item['type']
        page = item['page_indices'][0]
        coords = np.array(item['coordinates']) * coord_scale
        
        pix, img = extract_image(document[page-1], coords)
        pix.save(output_dir / f'{img_type}{indices[img_type]}-page{page}.png')

        indices[img_type] += 1


def get_chunk_type(element: DocumentPartition) -> str|None:
    class_proba = element.metadata.detection_class_prob
    page_number = element.metadata.page_number
    if element.type == 'Title' and class_proba >= 0.7 and page_number > 5 and not (
        element.text.startswith((
            #'Foreword', 
            #'National', 
            'where', 
            'English', 
            'Contents', 
            'Table', 
            'Figure',
        ))
    ):
        return 'title'
    elif np.isin(element.type, ['Image', 'Formula']):
        return element.type
    elif element.text.startswith('Table') or (element.type == 'Table' and class_proba >= 0.85):
        return 'table'
    elif element.text.startswith('Figure'):
        return 'figure'
    elif re.match(r'[.]+.+[(]+\d+.+[)]+', element.text):
        return 'formula'
    
    return None


def partitions_by_page_iterator(
    partitions: List[DocumentPartition],
    start: int = 1,
    end: int = -1
) -> Iterator[DocumentPartition]:
    end = partitions[-1].metadata.page_number if end == -1 else end
    for page_number in range(start, end + 1):
        page_elements = [element for element in partitions if element.metadata.page_number == page_number]
        yield page_elements


def extract_full_title(
    element: DocumentPartition,
    page: pymupdf.Page
):
    coordinates = element.get_rect()
    coordinates *= page.rect.height / element.metadata.coordinates.layout_height
    coordinates[0,0] = 52
    coordinates[1,0] = 772
    rect = pymupdf.Rect(coordinates.tolist())

    content = page.get_text('text', clip=rect).split('\n')
    full_title = ' '.join(content).strip()

    return full_title


def extract_page_label(
    page: pymupdf.Page
):
    rect = pymupdf.Rect(
        52,
        page.rect.height - 40,
        772,
        page.rect.height
    )

    content = page.get_text('text', clip=rect).splitlines()
    for line in content:
        if re.match(r'\d', line.strip()):
            return line.strip()
        

def get_overlap_sentences(
    chunks: list[str],
    chunk_pages: list[int],
    overlap_tokens: int,
) -> tuple[str, list]:
    tokenizer = tiktoken.get_encoding("cl100k_base")
    sentence_tokens = 0
    overlap_pages = []
    overlap_text = ''
    for chunk, page in zip(reversed(chunks), reversed(chunk_pages)):
        for sentence in reversed(chunk.split('. ')):
            sentence_tokens += len(tokenizer.encode(sentence))
            overlap_text = sentence + '. ' + overlap_text
            overlap_pages.append(page)
            if sentence_tokens > overlap_tokens:
                return overlap_text, overlap_pages
            
    return overlap_text, overlap_pages


def chunk_text(
    content_buffer: list[tuple[str, int]],
    chunk_tokens: int = 400,
    overlap_tokens: int = 60
) -> tuple[list[str], list[list[int]]]:
    tokenizer = tiktoken.get_encoding("cl100k_base")

    token_count = 0
    text = ''
    chunks = []
    content = []
    page_indices = []
    chunk_pages = []

    # Chunk by paragraphs
    for line, page in content_buffer:
        token_count += len(tokenizer.encode(line))
        text += line + '\n '
        chunks.append(line)
        chunk_pages.append(page)
        if token_count >= chunk_tokens:
            content.append(text.strip())
            page_indices.append(list(set(chunk_pages)))

            # Overlap by sentences
            overlap_text, overlap_pages = get_overlap_sentences(chunks, chunk_pages, overlap_tokens)
            
            # Prepare for next chunk
            chunk_pages = overlap_pages
            token_count = 0
            text = overlap_text.strip() + '\n '

    if token_count > 0:
        content.append(text.strip())
        page_indices.append(list(set(chunk_pages)))

    return content, page_indices


def process_section(
    data: list[dict],
    index: int,
    content_buffer: str,
    sections: list[str],
    elements: list[DocumentPartition],
    document: pymupdf.Document,
    page_start: int,
) -> tuple[Any]:
    tokenizer = tiktoken.get_encoding("cl100k_base")
    token_count = len(tokenizer.encode('\n'.join([text for text, _ in content_buffer])))
    element = elements[index]
    content = element.text.strip()
    page = element.metadata.page_number

    content = extract_full_title(
        element,
        document[page - 1]
    )
    
    # Check for false positives, not in format  example: "1.2.3 Section Title"
    if not re.match(r'^\d+(\.\d+)* .*', content) and not content.startswith('Bibliography'):
        return data, index, content_buffer, sections, page_start
    
    # Save text buffer before processing new section
    if token_count > 0:
        chunks, list_page_indices = chunk_text(content_buffer)
        for chunk, page_indices in zip(chunks, list_page_indices):
            data.append({
                'document_name': elements[0].metadata.filename,
                'page_indices': list(map(lambda x: x - 1, page_indices)),
                'page_labels': [extract_page_label(document[page - 1]) for page in page_indices],
                'type': 'text',
                'sections': sections,
                'content': chunk,
                'token_count': len(tokenizer.encode(chunk)),
            })

        content_buffer = []
        page_start = element.metadata.page_number

    # Find section depth
    label = content.split(' ')[0]
    section_depth = len(label.split('.')) - 1
    
    # Store current section and parent sections
    sections = sections[:section_depth]
    sections.append(content)

    return data, index, content_buffer, sections, page_start


def process_image(
    data: list[dict],
    index: int,
    elements: list[DocumentPartition],
    sections: list[str],
    document: pymupdf.Document,
    coords: np.ndarray|None = None
) -> tuple[list[dict], int]:
    coords = np.array([[0, 0]]) if coords is None else coords
    element = elements[index]
    data.append({
        'document_name': elements[0].metadata.filename,
        'page_indices': [element.metadata.page_number - 1],
        'page_labels': [extract_page_label(document[element.metadata.page_number - 1])],
        'type': 'image',
        'sections': sections,
        'coordinates': [
            coords[0].tolist(),
            element.get_rect()[1].tolist()
        ],
        'height': element.metadata.coordinates.layout_height,
        'width': element.metadata.coordinates.layout_width,
        'content': element.text.strip()
    })
    
    return data, index


def process_formula(
    data: list[dict],
    index: int,
    content_buffer: list[tuple[str, int]],
    elements: list[DocumentPartition],
    sections: list[str],
    document: pymupdf.Document
) -> tuple[list[dict], int]:
    element = elements[index]
    coords = element.get_rect()
    coords[0,1] -= 50
    coords[1,1] += 50
    
    content = element.text.strip()
    content = unidecode(content)

    if re.search(r'\(\d(\.\d+)*[a-z]?\)', content):
        content = '$$' + content + '$$'
    else:
        content = '$' + content + '$'

    content_buffer.append((content, element.metadata.page_number - 1))

    return data, index, content_buffer


def process_figure(
    data: list[dict],
    index: int,
    content_buffer: list[tuple[str, int]],
    elements: list[DocumentPartition],
    sections: list[str],
    document: pymupdf.Document,
    coords: np.ndarray|None = None
) -> tuple[list[dict], int]:
    element = elements[index]
    coords = element.get_rect() if coords is None else coords
    while index < len(elements):
        element = elements[index]
        
        formula_label = re.search(r'[.]+.+[(]+\d+.+[)]+', element.text)
        if element.text.startswith('Figure'):
            data, index = process_image(
                data, 
                index, 
                elements,
                sections,
                document,
                coords
            )
            break
        elif formula_label is not None:
            data, index, content_buffer = process_formula(
                data,
                index,
                content_buffer,
                elements,
                sections,
                document
            )
            break

        index += 1

    return data, index, content_buffer


def process_table(
    data: list[dict],
    index: int,
    elements: list[DocumentPartition],
    sections: list[str],
    document: pymupdf.Document
) -> tuple[list[dict], int]:
    coords = elements[index].get_rect()
    content = elements[index].text.strip()
    while index < len(elements):
        element = elements[index]
        
        if element.type == 'Table':
            break
        
        index += 1

    new_coords = element.get_rect()
    data.append({
        'document_name': elements[0].metadata.filename,
        'page_indices': [element.metadata.page_number - 1],
        'page_labels': [extract_page_label(document[element.metadata.page_number - 1])],
        'type': 'table',
        'sections': sections,
        'coordinates': [
            coords[0].tolist(),
            new_coords[1].tolist()
        ],
        'height': element.metadata.coordinates.layout_height,
        'width': element.metadata.coordinates.layout_width,
        'content': content
    })

    return data, index


def process_partitions(
    partitions: list[DocumentPartition],
    document: pymupdf.Document,
    start: int = 1,
    end: int = -1,
) -> list[dict]:
    
    if start < 1:
        raise ValueError('Start page must be >= 1')
    if end != -1 and end < start:
        raise ValueError('End page must be >= start page')

    data: list[dict] = []
    sections : list[str] = ['Foreword']
    
    tokenizer = tiktoken.get_encoding("cl100k_base")
    content_buffer = []
    page_start = start
    for page, elements in enumerate(partitions_by_page_iterator(partitions, start=start, end=end), start=start):
        index = 0
        while index < len(elements):
            element = elements[index]
            chunk_type = get_chunk_type(element)

            match chunk_type:
                case 'Image' | 'Formula':
                    data, index, content_buffer = process_figure(
                        data,
                        index,
                        content_buffer,
                        elements,
                        sections,
                        document
                    )
                case 'table' | 'Table':
                    data, index = process_table(
                        data,
                        index,
                        elements,
                        sections,
                        document
                    )
                case 'figure':
                    data, index = process_image(
                        data,
                        index,
                        elements,
                        sections,
                        document
                    )
                case 'formula':
                    data, index, content_buffer = process_formula(
                        data,
                        index,
                        content_buffer,
                        elements,
                        sections,
                        document
                    )
                case 'title':
                    data, index, content_buffer, sections, page_start = process_section(
                        data,
                        index,
                        content_buffer,
                        sections,
                        elements,
                        document,
                        page_start,
                    )
                case _:
                    # content_buffer += '\n' + element.text.strip()
                    content_buffer.append((element.text.strip(), page))
                    
            index += 1
            
    # Save remaining text buffer
    data.append({
        'document_name': partitions[0].metadata.filename,
        'page_indices': list(range(page_start - 1, page)),
        'page_labels': [extract_page_label(document[page - 1]) for page in range(page_start, page + 1)],
        'type': 'text',
        'sections': sections,
        'content': '\n '.join([text for text, _ in content_buffer]),
        'token_count': len(tokenizer.encode('\n'.join([text for text, _ in content_buffer]))),                
    })
    
    return data