from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field
from typing import List, Optional
import psycopg2
from pgvector.psycopg2 import register_vector
from psycopg2.extras import RealDictCursor
import socket
import httpx

from app.core.config import settings
from app.services.document_parser import parse_file_bytes, parse_file_path, chunk_text

router = APIRouter()


def _ipv4_http_client(**kwargs) -> httpx.AsyncClient:
    """返回强制 IPv4 的 httpx.AsyncClient，避免 Docker 容器 IPv6 不通导致连接失败。"""
    transport = httpx.AsyncHTTPTransport(local_address="0.0.0.0")
    return httpx.AsyncClient(transport=transport, **kwargs)


def _make_openai_client(api_key: str, base_url=None):
    """创建强制 IPv4 的 AsyncOpenAI 客户端。"""
    from openai import AsyncOpenAI
    http_client = _ipv4_http_client(timeout=httpx.Timeout(120.0))
    return AsyncOpenAI(api_key=api_key, base_url=base_url or None, http_client=http_client)


class EmbeddingRequest(BaseModel):
    texts: List[str]


class EmbeddingResponse(BaseModel):
    embeddings: List[List[float]]


class SearchRequest(BaseModel):
    query: str
    knowledgeBaseIds: List[str] = []
    topK: int = Field(default=5, ge=1, le=20)


class ChunkResult(BaseModel):
    chunkId: str
    documentId: str
    content: str
    score: float


class SearchResponse(BaseModel):
    chunks: List[ChunkResult]


def get_db():
    conn = psycopg2.connect(settings.DATABASE_URL)
    register_vector(conn)
    return conn


def get_default_embedding_model():
    """Query DB for the default embedding model and its provider config."""
    conn = psycopg2.connect(settings.DATABASE_URL)
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT m.model_id, p.api_key, p.base_url
            FROM ai_models m
            JOIN ai_providers p ON m.provider_id = p.id
            WHERE m.type = 'embedding'
              AND m.is_default = true
              AND m.is_enabled = true
              AND p.is_enabled = true
            LIMIT 1
        """)
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def build_embedding_client():
    """Return (AsyncOpenAI client, model_id) using DB config or env fallback."""
    db_model = get_default_embedding_model()
    if db_model and db_model.get("api_key"):
        client = _make_openai_client(
            api_key=db_model["api_key"],
            base_url=db_model.get("base_url"),
        )
        return client, db_model["model_id"]
    # Fallback to env vars
    return _make_openai_client(api_key=settings.OPENAI_API_KEY), settings.EMBEDDING_MODEL


def build_chat_client():
    """Return (AsyncOpenAI client, model_id) for the default chat model from DB."""
    conn = psycopg2.connect(settings.DATABASE_URL)
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT m.model_id, p.api_key, p.base_url
            FROM ai_models m
            JOIN ai_providers p ON m.provider_id = p.id
            WHERE m.type = 'chat'
              AND m.is_default = true
              AND m.is_enabled = true
              AND p.is_enabled = true
            LIMIT 1
        """)
        row = cur.fetchone()
    finally:
        conn.close()

    if not row:
        raise RuntimeError("未配置默认 Chat 模型，请在系统管理 → AI 设置中设置默认模型")

    client = _make_openai_client(
        api_key=row["api_key"] or "sk-placeholder",
        base_url=row.get("base_url"),
    )
    return client, row["model_id"]


@router.post("/embed", response_model=EmbeddingResponse)
async def embed(request: EmbeddingRequest):
    try:
        client, model_id = build_embedding_client()
        result = await client.embeddings.create(
            model=model_id,
            input=request.texts,
        )
        embeddings = [d.embedding for d in result.data]
        return EmbeddingResponse(embeddings=embeddings)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Embedding failed: {str(e)}")


@router.post("/search", response_model=SearchResponse)
async def search(request: SearchRequest):
    try:
        client, model_id = build_embedding_client()
        query_embedding_resp = await client.embeddings.create(
            model=model_id,
            input=[request.query],
        )
        query_embedding = query_embedding_resp.data[0].embedding

        conn = None
        try:
            conn = get_db()
            cur = conn.cursor(cursor_factory=RealDictCursor)

            if request.knowledgeBaseIds:
                placeholders = ','.join(['%s'] * len(request.knowledgeBaseIds))
                sql = f"""
                    SELECT
                        dc.id AS chunk_id,
                        dc.document_id,
                        dc.content,
                        1 - (dc.embedding <=> %s::vector) AS score
                    FROM document_chunks dc
                    JOIN knowledge_base_documents d ON dc.document_id = d.id
                    WHERE d.knowledge_base_id IN ({placeholders})
                        AND dc.embedding IS NOT NULL
                    ORDER BY dc.embedding <=> %s::vector
                    LIMIT %s
                """
                params = [query_embedding] + request.knowledgeBaseIds + [query_embedding, request.topK]
            else:
                sql = """
                    SELECT
                        dc.id AS chunk_id,
                        dc.document_id,
                        dc.content,
                        1 - (dc.embedding <=> %s::vector) AS score
                    FROM document_chunks dc
                    WHERE dc.embedding IS NOT NULL
                    ORDER BY dc.embedding <=> %s::vector
                    LIMIT %s
                """
                params = [query_embedding, query_embedding, request.topK]

            cur.execute(sql, params)
            rows = cur.fetchall()

            chunks = [
                ChunkResult(
                    chunkId=str(row['chunk_id']),
                    documentId=str(row['document_id']),
                    content=row['content'],
                    score=round(float(row['score']), 4),
                )
                for row in rows
            ]
            return SearchResponse(chunks=chunks)
        finally:
            if conn:
                conn.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


# ── Parse endpoint ──────────────────────────────────────────────────────────

class ParseByPathRequest(BaseModel):
    filePath: str
    fileName: str


class ParseResponse(BaseModel):
    text: str
    chunks: List[str]
    chunkCount: int


@router.post("/parse-path", response_model=ParseResponse)
async def parse_by_path(request: ParseByPathRequest):
    """Parse a document from a local file path (shared volume) and return text + chunks."""
    try:
        text = parse_file_path(request.filePath, request.fileName)
        chunks = chunk_text(text)
        return ParseResponse(text=text, chunks=chunks, chunkCount=len(chunks))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"File not found: {request.filePath}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Parse failed: {str(e)}")


@router.post("/parse-upload", response_model=ParseResponse)
async def parse_upload(file: UploadFile = File(...)):
    """Parse an uploaded file and return text + chunks."""
    try:
        data = await file.read()
        text = parse_file_bytes(data, file.filename or "unknown")
        chunks = chunk_text(text)
        return ParseResponse(text=text, chunks=chunks, chunkCount=len(chunks))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Parse failed: {str(e)}")
