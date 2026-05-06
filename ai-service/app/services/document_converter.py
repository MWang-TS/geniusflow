"""
Document conversion service: markitdown (local) and MinerU (cloud API).

Conversion priority:
  - If mineru API key provided → MinerU Precision API (VLM, 1000 pages/day free)
  - Else if file ≤ 10 MB → MinerU Agent Lightweight (no auth, IP-limited)
  - Else → markitdown (pure local, MIT license)
"""

import io
import json
import time
import zipfile
import logging
import tempfile
import os
from pathlib import Path

import httpx

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# markitdown (local)
# ---------------------------------------------------------------------------

def convert_with_markitdown(file_bytes: bytes, filename: str) -> str:
    """Convert document bytes to markdown using markitdown (local, no API)."""
    try:
        from markitdown import MarkItDown
        md = MarkItDown()
        suffix = Path(filename).suffix.lower() or ".bin"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(file_bytes)
            tmp_path = tmp.name
        try:
            result = md.convert(tmp_path)
            return result.text_content or ""
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
    except ImportError:
        logger.warning("markitdown not installed, falling back to plain text extraction")
        return _plain_text_fallback(file_bytes, filename)
    except Exception as exc:
        logger.error("markitdown conversion failed: %s", exc)
        raise


def _plain_text_fallback(file_bytes: bytes, filename: str) -> str:
    """Best-effort plain text extraction without external dependencies."""
    ext = Path(filename).suffix.lower()
    if ext == ".txt" or ext == ".md":
        try:
            return file_bytes.decode("utf-8", errors="replace")
        except Exception:
            return ""
    if ext == ".pdf":
        try:
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            return "\n\n".join(page.extract_text() or "" for page in reader.pages)
        except Exception as exc:
            logger.error("pypdf fallback failed: %s", exc)
            return ""
    if ext in (".docx",):
        try:
            import docx
            doc = docx.Document(io.BytesIO(file_bytes))
            return "\n\n".join(p.text for p in doc.paragraphs if p.text.strip())
        except Exception as exc:
            logger.error("python-docx fallback failed: %s", exc)
            return ""
    return ""


# ---------------------------------------------------------------------------
# MinerU Agent Lightweight API (no auth, ≤10MB / ≤20 pages)
# ---------------------------------------------------------------------------

MINERU_LITE_UPLOAD = "https://mineru.net/api/v1/agent/parse/file"
MINERU_LITE_STATUS = "https://mineru.net/api/v1/agent/parse/{task_id}"
_LITE_POLL_INTERVAL = 5  # seconds
_LITE_MAX_WAIT = 600     # 10 min


async def convert_with_mineru_lite(file_bytes: bytes, filename: str) -> str:
    """Convert document using MinerU Agent Lightweight (no auth required)."""
    async with httpx.AsyncClient(timeout=60) as client:
        # Step 1: get signed upload URL + task_id
        init_resp = await client.post(
            MINERU_LITE_UPLOAD,
            headers={"Content-Type": "application/json"},
            json={"filename": filename, "is_ocr": True},
        )
        init_resp.raise_for_status()
        init_data = init_resp.json()
        if init_data.get("code") != 200:
            raise RuntimeError(f"MinerU Lite init failed: {init_data}")
        task_id: str = init_data["data"]["task_id"]
        file_url: str = init_data["data"]["file_url"]

        # Step 2: upload file bytes to signed URL
        upload_resp = await client.put(
            file_url,
            content=file_bytes,
            headers={"Content-Type": "application/octet-stream"},
        )
        upload_resp.raise_for_status()

    # Step 3: poll for result
    markdown = await _poll_mineru_lite(task_id)
    return markdown


async def _poll_mineru_lite(task_id: str) -> str:
    url = MINERU_LITE_STATUS.format(task_id=task_id)
    elapsed = 0
    async with httpx.AsyncClient(timeout=30) as client:
        while elapsed < _LITE_MAX_WAIT:
            await _async_sleep(_LITE_POLL_INTERVAL)
            elapsed += _LITE_POLL_INTERVAL
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
            if data.get("code") != 200:
                raise RuntimeError(f"MinerU Lite poll error: {data}")
            state = data["data"].get("state", "")
            if state == "done":
                markdown_url = data["data"].get("markdown_url", "")
                if not markdown_url:
                    raise RuntimeError("MinerU Lite: done but no markdown_url")
                async with httpx.AsyncClient(timeout=60) as dl:
                    md_resp = await dl.get(markdown_url)
                    md_resp.raise_for_status()
                    return md_resp.text
            if state == "failed":
                raise RuntimeError(f"MinerU Lite task failed: {data}")
    raise TimeoutError(f"MinerU Lite task {task_id} timed out after {_LITE_MAX_WAIT}s")


# ---------------------------------------------------------------------------
# MinerU Precision API (Bearer token, free 1000 pages/day high-priority)
# ---------------------------------------------------------------------------

MINERU_PRECISION_BATCH = "https://mineru.net/api/v4/file-urls/batch"
MINERU_PRECISION_STATUS = "https://mineru.net/api/v4/extract-results/batch/{batch_id}"
_PREC_POLL_INTERVAL = 8
_PREC_MAX_WAIT = 900  # 15 min


async def convert_with_mineru_precision(
    file_bytes: bytes,
    filename: str,
    api_key: str,
    model_version: str = "vlm",
) -> str:
    """Convert document using MinerU Precision API (requires Bearer token)."""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=60) as client:
        # Step 1: request batch + signed upload URL
        init_resp = await client.post(
            MINERU_PRECISION_BATCH,
            headers=headers,
            json={
                "files": [{"name": filename, "is_ocr": True, "data_id": "geniusflow"}],
                "model_version": model_version,
            },
        )
        init_resp.raise_for_status()
        init_data = init_resp.json()
        if init_data.get("code") != 200:
            raise RuntimeError(f"MinerU Precision init failed: {init_data}")

        batch_id: str = init_data["data"]["batch_id"]
        file_url: str = init_data["data"]["file_urls"][0]

        # Step 2: upload file to signed URL (no auth header here)
        upload_resp = await client.put(
            file_url,
            content=file_bytes,
            headers={"Content-Type": "application/octet-stream"},
        )
        upload_resp.raise_for_status()

    # Step 3: poll
    return await _poll_mineru_precision(batch_id, api_key)


async def _poll_mineru_precision(batch_id: str, api_key: str) -> str:
    url = MINERU_PRECISION_STATUS.format(batch_id=batch_id)
    headers = {"Authorization": f"Bearer {api_key}"}
    elapsed = 0
    async with httpx.AsyncClient(timeout=30) as client:
        while elapsed < _PREC_MAX_WAIT:
            await _async_sleep(_PREC_POLL_INTERVAL)
            elapsed += _PREC_POLL_INTERVAL
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            if data.get("code") != 200:
                raise RuntimeError(f"MinerU Precision poll error: {data}")
            results = data.get("data", {}).get("extract_result", [])
            if not results:
                continue
            result = results[0]
            state = result.get("state", "")
            if state == "done":
                zip_url = result.get("full_zip_url", "")
                if not zip_url:
                    raise RuntimeError("MinerU Precision: done but no full_zip_url")
                return await _download_zip_markdown(zip_url)
            if state == "failed":
                raise RuntimeError(f"MinerU Precision task failed: {result}")
    raise TimeoutError(f"MinerU Precision batch {batch_id} timed out after {_PREC_MAX_WAIT}s")


async def _download_zip_markdown(zip_url: str) -> str:
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.get(zip_url)
        resp.raise_for_status()
        zip_bytes = resp.content
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        # Find full.md inside the ZIP (may be nested)
        for name in zf.namelist():
            if name.endswith("full.md"):
                return zf.read(name).decode("utf-8", errors="replace")
        # Fallback: read any .md file
        for name in zf.namelist():
            if name.endswith(".md"):
                return zf.read(name).decode("utf-8", errors="replace")
    raise RuntimeError("MinerU Precision ZIP contains no markdown file")


# ---------------------------------------------------------------------------
# High-level dispatcher
# ---------------------------------------------------------------------------

async def convert_document(
    file_bytes: bytes,
    filename: str,
    mineru_api_key: str = "",
    mineru_model_version: str = "vlm",
) -> tuple[str, str]:
    """
    Convert a document to markdown using the best available method.

    Returns:
        (markdown_text, converter_mode_used)
    """
    file_size = len(file_bytes)
    LITE_MAX_BYTES = 10 * 1024 * 1024  # 10 MB

    if mineru_api_key:
        logger.info("Converting %s with MinerU Precision API", filename)
        try:
            md = await convert_with_mineru_precision(
                file_bytes, filename, mineru_api_key, mineru_model_version
            )
            return md, "mineru_precision"
        except Exception as exc:
            logger.warning("MinerU Precision failed, falling back: %s", exc)

    if file_size <= LITE_MAX_BYTES:
        logger.info("Converting %s with MinerU Lite API", filename)
        try:
            md = await convert_with_mineru_lite(file_bytes, filename)
            return md, "mineru_lite"
        except Exception as exc:
            logger.warning("MinerU Lite failed, falling back to markitdown: %s", exc)

    logger.info("Converting %s with markitdown (local)", filename)
    md = convert_with_markitdown(file_bytes, filename)
    return md, "markitdown"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _async_sleep(seconds: float) -> None:
    import asyncio
    await asyncio.sleep(seconds)
