"""
Wiki pipeline: compile raw markdown sources into structured wiki pages,
and query the wiki knowledge base.

Implements the Karpathy LLM Wiki pattern:
  - Raw sources are compiled into persistent, interlinked wiki pages
  - index.md and log.md serve as navigation hubs
  - Pages cross-reference each other with [[WikiLink]] syntax
  - Queries read the index → find relevant pages → LLM synthesizes
"""

import json
import re
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List

from app.core.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ConvertRequest(BaseModel):
    file_bytes_b64: str  # base64-encoded file content
    filename: str
    mineru_api_key: str = ""
    mineru_model_version: str = "vlm"


class ConvertResponse(BaseModel):
    markdown: str
    converter_mode: str


class IngestRequest(BaseModel):
    kb_id: str
    source_id: str
    markdown_content: str
    filename: str


class IngestResponse(BaseModel):
    pages_created: int
    pages_updated: int
    page_slugs: List[str]


class WikiQueryRequest(BaseModel):
    kb_id: str
    question: str
    model: str = "gpt-4o-mini"
    max_pages: int = Field(default=5, ge=1, le=10)


class WikiQueryResponse(BaseModel):
    answer: str
    pages_used: List[str]


class WikiLintRequest(BaseModel):
    kb_id: str


class WikiLintResponse(BaseModel):
    orphan_pages: List[str]
    broken_links: List[dict]
    total_pages: int


# ---------------------------------------------------------------------------
# Convert endpoint
# ---------------------------------------------------------------------------

@router.post("/convert", response_model=ConvertResponse)
async def convert_document(req: ConvertRequest):
    """Convert an uploaded document to markdown using best available method."""
    import base64
    from app.services.document_converter import convert_document as _convert
    try:
        file_bytes = base64.b64decode(req.file_bytes_b64)
        markdown, mode = await _convert(
            file_bytes,
            req.filename,
            mineru_api_key=req.mineru_api_key,
            mineru_model_version=req.mineru_model_version,
        )
        return ConvertResponse(markdown=markdown, converter_mode=mode)
    except Exception as exc:
        logger.error("Wiki convert error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


# ---------------------------------------------------------------------------
# Ingest endpoint — compile markdown source into wiki pages
# ---------------------------------------------------------------------------

WIKI_COMPILER_SYSTEM_PROMPT = """You are a wiki knowledge compiler. Your task is to read a source document and extract/create structured wiki pages.

## Output format
Return ONLY a valid JSON array of pages. Each page object has these fields:
- "slug": URL-safe lowercase identifier using hyphens (e.g. "machine-learning-basics")
- "title": Human-readable title
- "page_type": one of: "concept", "entity", "index", "log"
- "tags": array of relevant tag strings
- "content": Full markdown content for this page. Use [[Other Page Title]] syntax for cross-references.

## Guidelines
- Extract 3-15 pages depending on document richness
- Create one "index" page that links to all extracted pages
- Create concept pages for key ideas/processes
- Create entity pages for named things (products, organizations, people, systems)
- Each page should be self-contained but richly cross-linked
- Do NOT wrap the JSON in markdown fences — return raw JSON array only
"""


@router.post("/ingest", response_model=IngestResponse)
async def ingest_source(req: IngestRequest):
    """Compile a markdown document into wiki pages using LLM."""
    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

        # Truncate to 30k chars to stay within context window
        content = req.markdown_content[:30000]

        user_msg = f"""Source document filename: {req.filename}

---
{content}
---

Extract and compile wiki pages from this document."""

        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": WIKI_COMPILER_SYSTEM_PROMPT},
                {"role": "user", "content": user_msg},
            ],
            temperature=0.2,
            response_format={"type": "json_object"},
        )

        raw = response.choices[0].message.content or "[]"
        # The model may return {"pages": [...]} or a bare array
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            pages = parsed.get("pages", parsed.get("data", list(parsed.values())[0] if parsed else []))
        else:
            pages = parsed

        if not isinstance(pages, list):
            raise ValueError("LLM did not return a list of pages")

        # Upsert pages into DB via Prisma (direct SQL)
        import psycopg2
        from psycopg2.extras import execute_values
        conn = psycopg2.connect(settings.DATABASE_URL)
        created = 0
        updated = 0
        slugs: List[str] = []
        try:
            with conn.cursor() as cur:
                for page in pages:
                    slug = _slugify(page.get("slug", page.get("title", "page")))
                    title = page.get("title", slug)
                    page_type = page.get("page_type", "concept")
                    tags = page.get("tags", [])
                    content_md = page.get("content", "")
                    source_file = req.filename

                    cur.execute(
                        """
                        INSERT INTO wiki_pages (id, knowledge_base_id, slug, title, content, page_type, tags, source_file, created_at, updated_at)
                        VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
                        ON CONFLICT (knowledge_base_id, slug)
                        DO UPDATE SET title = EXCLUDED.title, content = EXCLUDED.content,
                                      page_type = EXCLUDED.page_type, tags = EXCLUDED.tags,
                                      source_file = EXCLUDED.source_file, updated_at = NOW()
                        RETURNING (xmax = 0) AS is_insert
                        """,
                        (req.kb_id, slug, title, content_md, page_type, tags, source_file),
                    )
                    row = cur.fetchone()
                    if row and row[0]:
                        created += 1
                    else:
                        updated += 1
                    slugs.append(slug)
            conn.commit()
        finally:
            conn.close()

        return IngestResponse(pages_created=created, pages_updated=updated, page_slugs=slugs)

    except Exception as exc:
        logger.error("Wiki ingest error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


# ---------------------------------------------------------------------------
# Query endpoint
# ---------------------------------------------------------------------------

WIKI_QUERY_SYSTEM = """You are a knowledgeable assistant. You answer questions using ONLY the provided wiki pages. 
Cite relevant page titles using [[Title]] notation when drawing from them.
If the answer is not found in the provided pages, say so clearly."""


@router.post("/query", response_model=WikiQueryResponse)
async def query_wiki(req: WikiQueryRequest):
    """Query the wiki knowledge base using the index-guided navigation approach."""
    try:
        import psycopg2
        from psycopg2.extras import RealDictCursor
        from openai import AsyncOpenAI

        conn = psycopg2.connect(settings.DATABASE_URL)
        ai = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Step 1: get index page
                cur.execute(
                    "SELECT slug, title, content FROM wiki_pages WHERE knowledge_base_id = %s AND page_type = 'index' LIMIT 1",
                    (req.kb_id,),
                )
                index_row = cur.fetchone()

                # Step 2: get all page titles for the LLM to pick from
                cur.execute(
                    "SELECT slug, title, page_type, tags FROM wiki_pages WHERE knowledge_base_id = %s ORDER BY page_type, title",
                    (req.kb_id,),
                )
                all_pages = cur.fetchall()
        finally:
            conn.close()

        if not all_pages:
            return WikiQueryResponse(answer="该 Wiki 知识库暂无内容，请先上传并解析文档。", pages_used=[])

        # Step 3: ask LLM which pages are relevant
        page_list = "\n".join(
            f"- [{p['slug']}] {p['title']} ({p['page_type']})" for p in all_pages
        )
        index_context = f"Index page:\n{index_row['content']}\n\n" if index_row else ""

        selector_resp = await ai.chat.completions.create(
            model=req.model,
            messages=[
                {
                    "role": "system",
                    "content": "You are a wiki navigator. Given a question and a list of wiki pages, "
                               "return ONLY a JSON array of the most relevant page slugs (max "
                               + str(req.max_pages)
                               + "). Example: [\"page-slug-1\", \"page-slug-2\"]",
                },
                {
                    "role": "user",
                    "content": f"{index_context}Available pages:\n{page_list}\n\nQuestion: {req.question}",
                },
            ],
            temperature=0,
            response_format={"type": "json_object"},
        )
        raw = selector_resp.choices[0].message.content or "[]"
        try:
            selected = json.loads(raw)
            if isinstance(selected, dict):
                selected = list(selected.values())[0] if selected else []
        except Exception:
            selected = []

        selected_slugs: List[str] = [s for s in selected if isinstance(s, str)][:req.max_pages]

        # Step 4: load full content of selected pages
        if not selected_slugs:
            selected_slugs = [p["slug"] for p in all_pages[:req.max_pages]]

        conn2 = psycopg2.connect(settings.DATABASE_URL)
        try:
            with conn2.cursor(cursor_factory=RealDictCursor) as cur:
                placeholders = ",".join(["%s"] * len(selected_slugs))
                cur.execute(
                    f"SELECT slug, title, content FROM wiki_pages WHERE knowledge_base_id = %s AND slug IN ({placeholders})",
                    [req.kb_id] + selected_slugs,
                )
                page_contents = cur.fetchall()
        finally:
            conn2.close()

        context = "\n\n---\n\n".join(
            f"# {p['title']}\n{p['content']}" for p in page_contents
        )

        # Step 5: generate answer
        answer_resp = await ai.chat.completions.create(
            model=req.model,
            messages=[
                {"role": "system", "content": WIKI_QUERY_SYSTEM},
                {
                    "role": "user",
                    "content": f"Wiki pages:\n\n{context}\n\n---\n\nQuestion: {req.question}",
                },
            ],
            temperature=0.3,
        )
        answer = answer_resp.choices[0].message.content or ""
        return WikiQueryResponse(answer=answer, pages_used=selected_slugs)

    except Exception as exc:
        logger.error("Wiki query error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


# ---------------------------------------------------------------------------
# Lint endpoint
# ---------------------------------------------------------------------------

@router.post("/lint", response_model=WikiLintResponse)
async def lint_wiki(req: WikiLintRequest):
    """Check for orphan pages and broken cross-references."""
    import psycopg2
    from psycopg2.extras import RealDictCursor

    conn = psycopg2.connect(settings.DATABASE_URL)
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT slug, title, content FROM wiki_pages WHERE knowledge_base_id = %s",
                (req.kb_id,),
            )
            pages = cur.fetchall()
    finally:
        conn.close()

    slug_set = {p["slug"] for p in pages}
    all_referenced: set = set()
    broken: List[dict] = []

    for page in pages:
        refs = re.findall(r"\[\[([^\]]+)\]\]", page["content"])
        for ref in refs:
            ref_slug = _slugify(ref)
            all_referenced.add(ref_slug)
            if ref_slug not in slug_set:
                broken.append({"source": page["slug"], "missing_link": ref, "missing_slug": ref_slug})

    orphan_pages = [p["slug"] for p in pages if p["slug"] not in all_referenced and p["slug"] != "index"]

    return WikiLintResponse(
        orphan_pages=orphan_pages,
        broken_links=broken,
        total_pages=len(pages),
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _slugify(text: str) -> str:
    """Convert text to URL-safe slug."""
    s = text.lower().strip()
    s = re.sub(r"[^\w\s-]", "", s)
    s = re.sub(r"[\s_]+", "-", s)
    s = re.sub(r"-+", "-", s)
    return s[:80].strip("-")
