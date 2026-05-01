import re
from typing import List


def parse_content(content: str, file_name: str) -> str:
    ext = file_name.rsplit('.', 1)[-1].lower() if '.' in file_name else ''
    if ext == 'txt':
        return content
    return content


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> List[str]:
    sentences = re.split(r'(?<=[。！？.!?\n])', text)
    chunks = []
    current = ''

    for sentence in sentences:
        if len(current) + len(sentence) > chunk_size and current:
            chunks.append(current.strip())
            current = current[-overlap:] if len(current) > overlap else ''
        current += sentence

    if current.strip():
        chunks.append(current.strip())

    return chunks
