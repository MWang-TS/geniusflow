from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
import json
import asyncio
from openai import AsyncOpenAI
import psycopg2
from pgvector.psycopg2 import register_vector
from psycopg2.extras import RealDictCursor

from app.core.config import settings

router = APIRouter()
client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


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


@router.post("/embed", response_model=EmbeddingResponse)
async def embed(request: EmbeddingRequest):
    try:
        result = await client.embeddings.create(
            model=settings.EMBEDDING_MODEL,
            input=request.texts,
        )
        embeddings = [d.embedding for d in result.data]
        return EmbeddingResponse(embeddings=embeddings)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Embedding failed: {str(e)}")


@router.post("/search", response_model=SearchResponse)
async def search(request: SearchRequest):
    try:
        query_embedding_resp = await client.embeddings.create(
            model=settings.EMBEDDING_MODEL,
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
