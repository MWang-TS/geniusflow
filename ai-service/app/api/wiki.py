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
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel, Field
from typing import List

from app.core.config import settings
from app.api.knowledge import build_chat_client

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
    max_pages: int = Field(default=8, ge=1, le=20)


class WikiQueryResponse(BaseModel):
    answer: str
    pages_used: List[str]


class WikiPagesSearchRequest(BaseModel):
    kb_id: str
    question: str
    max_pages: int = Field(default=5, ge=1, le=20)
    content_max_chars: int = Field(default=2000, ge=100, le=10000)


class WikiPageSnippet(BaseModel):
    title: str
    slug: str
    content: str


class WikiPagesSearchResponse(BaseModel):
    pages: List[WikiPageSnippet]


class WikiLintRequest(BaseModel):
    kb_id: str


class GraphBuildRequest(BaseModel):
    kb_id: str


class GraphNode(BaseModel):
    id: str
    label: str
    type: str = "entity"  # entity | page
    size: int = 1


class GraphEdge(BaseModel):
    source: str
    target: str
    label: str


class GraphResponse(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]
    triple_count: int


class GraphBuildStatus(BaseModel):
    status: str  # queued | building | done | error
    triple_count: int = 0
    message: str = ""


# In-memory build status tracker (per kb_id)
_build_status: dict = {}


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
# Ingest endpoint — split markdown by headings and store sections directly
# ---------------------------------------------------------------------------

def _split_sections(content: str, filename: str) -> list:
    """Split markdown content into sections by H1/H2 headings."""
    parts = re.split(r'\n(?=#{1,2} )', '\n' + content.strip())
    sections = []
    for part in parts:
        part = part.strip()
        if not part:
            continue
        first_line = part.split('\n')[0]
        heading_match = re.match(r'^#{1,2}\s+(.+)', first_line)
        title = heading_match.group(1).strip() if heading_match else filename
        sections.append({'title': title, 'content': part})
    return sections or [{'title': filename, 'content': content}]


@router.post("/ingest", response_model=IngestResponse)
async def ingest_source(req: IngestRequest):
    """Split a markdown document by headings and store each section as a wiki page."""
    try:
        import psycopg2

        sections = _split_sections(req.markdown_content, req.filename)

        # Build an index page with table of contents
        toc_lines = [f"# 目录：{req.filename}\n",
                     f"来源文件：`{req.filename}`，共 {len(sections)} 个章节\n",
                     "## 章节列表\n"]
        for sec in sections:
            toc_lines.append(f"- [[{sec['title']}]]")

        all_pages = [{
            'slug': _slugify(f"index {req.filename}") or "index",
            'title': f"目录：{req.filename}",
            'page_type': 'index',
            'content': '\n'.join(toc_lines),
        }]
        for i, sec in enumerate(sections):
            slug = _slugify(sec['title']) or f"section-{i + 1}"
            all_pages.append({
                'slug': slug,
                'title': sec['title'],
                'page_type': 'source',
                'content': sec['content'],
            })

        conn = psycopg2.connect(settings.DATABASE_URL)
        created = 0
        updated = 0
        slugs: List[str] = []
        try:
            with conn.cursor() as cur:
                for page in all_pages:
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
                        (req.kb_id, page['slug'], page['title'], page['content'],
                         page['page_type'], [], req.filename),
                    )
                    row = cur.fetchone()
                    if row and row[0]:
                        created += 1
                    else:
                        updated += 1
                    slugs.append(page['slug'])
            conn.commit()
        finally:
            conn.close()

        return IngestResponse(pages_created=created, pages_updated=updated, page_slugs=slugs)

    except Exception as exc:
        logger.error("Wiki ingest error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/pages-search", response_model=WikiPagesSearchResponse)
async def search_wiki_pages(req: WikiPagesSearchRequest):
    """Keyword-rank wiki pages and return content without LLM call.

    Used by the AI assistant to inject wiki KB context without a second LLM call.
    Only returns pages with a positive keyword-match score.
    """
    try:
        import psycopg2
        from psycopg2.extras import RealDictCursor

        conn = psycopg2.connect(settings.DATABASE_URL)
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """SELECT slug, title, content, page_type
                       FROM wiki_pages
                       WHERE knowledge_base_id = %s
                       ORDER BY page_type, title""",
                    (req.kb_id,),
                )
                all_pages = cur.fetchall()
        finally:
            conn.close()

        if not all_pages:
            return WikiPagesSearchResponse(pages=[])

        # Score pages by keyword overlap
        q_lower = req.question.lower()
        q_tokens: set = set()
        for n in (2, 3, 4):
            q_tokens.update(q_lower[i:i + n] for i in range(len(q_lower) - n + 1))
        q_tokens.update(w for w in q_lower.split() if len(w) > 1)

        scored = []
        for p in all_pages:
            if p.get("page_type") == "index":
                continue
            title_lower = (p.get("title") or "").lower()
            content_lower = (p.get("content") or "").lower()
            combined = title_lower + " " + content_lower
            score = sum(1 for t in q_tokens if t in combined)
            if any(t in title_lower for t in q_tokens):
                score += 5
            if score > 0:
                scored.append((score, p))

        scored.sort(key=lambda x: -x[0])
        top = scored[: req.max_pages]

        pages = [
            WikiPageSnippet(
                title=p["title"] or "",
                slug=p["slug"] or "",
                content=(p["content"] or "")[: req.content_max_chars],
            )
            for _, p in top
        ]
        return WikiPagesSearchResponse(pages=pages)

    except Exception as exc:
        logger.error("Wiki pages-search error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


# ---------------------------------------------------------------------------
# Query endpoint
# ---------------------------------------------------------------------------

WIKI_QUERY_SYSTEM = """你是一个知识库问答助手。请根据提供的 Wiki 页面内容回答用户问题。
请用与问题相同的语言回答。引用具体页面时使用 [[页面标题]] 格式标注。
如果提供的页面中找不到答案，请如实告知。"""


def _keyword_rank(question: str, pages: list, top_n: int) -> list:
    """Rank pages by keyword overlap with the question (no LLM needed)."""
    q_lower = question.lower()
    # Generate bigrams and trigrams for Chinese; also split by space for English
    q_tokens: set = set()
    for n in (2, 3, 4):
        q_tokens.update(q_lower[i:i + n] for i in range(len(q_lower) - n + 1))
    q_tokens.update(w for w in q_lower.split() if len(w) > 1)

    scored = []
    for p in pages:
        if p.get('page_type') == 'index':
            continue  # skip index/TOC pages
        title_lower = (p.get('title') or '').lower()
        content_lower = (p.get('content') or '').lower()  # search full content
        combined = title_lower + ' ' + content_lower
        # Score: count matching n-gram tokens
        score = sum(1 for t in q_tokens if t in combined)
        # Strong bonus for title match
        if any(t in title_lower for t in q_tokens):
            score += 5
        scored.append((score, p))

    scored.sort(key=lambda x: -x[0])
    return [p for _, p in scored[:top_n]]


@router.post("/query", response_model=WikiQueryResponse)
async def query_wiki(req: WikiQueryRequest):
    """Query the wiki knowledge base. Uses keyword ranking + single LLM call."""
    try:
        import psycopg2
        from psycopg2.extras import RealDictCursor

        ai, model_id = build_chat_client()

        conn = psycopg2.connect(settings.DATABASE_URL)
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Load all pages with full content (non-index pages)
                cur.execute(
                    """SELECT slug, title, content, page_type
                       FROM wiki_pages
                       WHERE knowledge_base_id = %s
                       ORDER BY page_type, title""",
                    (req.kb_id,),
                )
                all_pages = cur.fetchall()
        finally:
            conn.close()

        if not all_pages:
            return WikiQueryResponse(answer="该 Wiki 知识库暂无内容，请先上传并解析文档。", pages_used=[])

        # Rank by keyword relevance (no LLM call needed)
        relevant_pages = _keyword_rank(req.question, all_pages, req.max_pages)
        if not relevant_pages:
            # fallback: take first N non-index pages
            relevant_pages = [p for p in all_pages if p.get('page_type') != 'index'][:req.max_pages]

        selected_slugs = [p['slug'] for p in relevant_pages]
        context = "\n\n---\n\n".join(
            f"# {p['title']}\n{p['content']}" for p in relevant_pages
        )

        # Single LLM call to generate answer
        answer_resp = await ai.chat.completions.create(
            model=model_id,
            messages=[
                {"role": "system", "content": WIKI_QUERY_SYSTEM},
                {
                    "role": "user",
                    "content": f"以下是相关 Wiki 页面内容：\n\n{context}\n\n---\n\n问题：{req.question}",
                },
            ],
            temperature=0.3,
        )
        answer = answer_resp.choices[0].message.content or ""
        return WikiQueryResponse(answer=answer, pages_used=selected_slugs)

    except Exception as exc:
        logger.error("Wiki query error: %s", exc, exc_info=True)
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
# Knowledge Graph endpoints
# ---------------------------------------------------------------------------

# (LLM-based extraction removed — graph is now built from page structure and [[WikiLink]] references)


@router.get("/graph/build/status/{kb_id}", response_model=GraphBuildStatus)
async def get_build_status(kb_id: str):
    """Return the current graph build status for a knowledge base."""
    status = _build_status.get(kb_id)
    if not status:
        return GraphBuildStatus(status="idle")
    return GraphBuildStatus(**status)


async def _do_build_graph(kb_id: str):
    """Background task: build graph from wiki page structure and [[WikiLink]] cross-references.

    Nodes = wiki pages (id=slug, label=title).
    Edges:
      - '引用'      : [[WikiLink]] references found in page content
      - '包含章节'  : index page → section pages from the same source file
    No LLM needed — deterministic, instant.
    """
    import asyncio
    import psycopg2
    from psycopg2.extras import RealDictCursor

    _build_status[kb_id] = {"status": "building", "triple_count": 0, "message": "正在分析页面结构..."}
    try:
        loop = asyncio.get_event_loop()

        def _build():
            conn = psycopg2.connect(settings.DATABASE_URL)
            try:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(
                        """SELECT slug, title, content, page_type, source_file
                           FROM wiki_pages WHERE knowledge_base_id = %s ORDER BY title""",
                        (kb_id,),
                    )
                    pages = [dict(r) for r in cur.fetchall()]

                if not pages:
                    return []

                # Build lookup maps
                slug_set = {p['slug'] for p in pages}
                title_to_slug = {p['title'].lower(): p['slug'] for p in pages}

                triples = []
                seen: set = set()

                def _add(subj, pred, obj, src):
                    key = (subj, pred, obj)
                    if key not in seen and subj != obj and subj in slug_set and obj in slug_set:
                        seen.add(key)
                        triples.append({'subject': subj, 'predicate': pred,
                                        'object': obj, 'source_slug': src})

                # ── [[WikiLink]] references ──
                for page in pages:
                    for ref in re.findall(r'\[\[([^\]]+)\]\]', page['content'] or ''):
                        ref_slug = _slugify(ref)
                        if ref_slug in slug_set:
                            target = ref_slug
                        elif ref.lower() in title_to_slug:
                            target = title_to_slug[ref.lower()]
                        else:
                            continue
                        _add(page['slug'], '引用', target, page['slug'])

                # ── Index → section edges (via source_file grouping) ──
                source_groups: dict = {}
                for p in pages:
                    sf = p.get('source_file')
                    if sf and p['page_type'] != 'index':
                        source_groups.setdefault(sf, []).append(p['slug'])
                for sf, slugs in source_groups.items():
                    idx_slug = _slugify(f"index {sf}")
                    if idx_slug in slug_set:
                        for s in slugs:
                            _add(idx_slug, '包含章节', s, idx_slug)

                # ── Store ──
                with conn.cursor() as cur:
                    cur.execute(
                        "DELETE FROM wiki_triples WHERE knowledge_base_id = %s", (kb_id,)
                    )
                    for t in triples:
                        cur.execute(
                            """INSERT INTO wiki_triples
                               (id, knowledge_base_id, subject, predicate, object, source_slug, created_at)
                               VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, NOW())""",
                            (kb_id, t['subject'], t['predicate'], t['object'], t['source_slug']),
                        )
                conn.commit()
                return triples
            finally:
                conn.close()

        triples = await loop.run_in_executor(None, _build)
        _build_status[kb_id] = {
            "status": "done",
            "triple_count": len(triples),
            "message": f"构建完成，共 {len(triples)} 条页面关联关系",
        }
        logger.info("Graph build done for kb=%s, triples=%d", kb_id, len(triples))

    except Exception as exc:
        logger.error("Graph build error: %s", exc, exc_info=True)
        _build_status[kb_id] = {"status": "error", "triple_count": 0, "message": str(exc)}


@router.post("/graph/build", response_model=GraphBuildStatus)
async def build_graph(req: GraphBuildRequest, background_tasks: BackgroundTasks):
    """Start an async graph build job. Returns immediately; poll /graph/build/status/{kb_id}."""
    kb_id = req.kb_id
    current = _build_status.get(kb_id, {})
    if current.get("status") == "building":
        return GraphBuildStatus(status="building",
                                triple_count=current.get("triple_count", 0),
                                message=current.get("message", "构建中..."))
    _build_status[kb_id] = {"status": "queued", "triple_count": 0, "message": "任务已加入队列"}
    background_tasks.add_task(_do_build_graph, kb_id)
    return GraphBuildStatus(status="queued", triple_count=0, message="任务已加入队列")


@router.get("/graph/{kb_id}", response_model=GraphResponse)
async def get_graph(kb_id: str):
    """Return the stored knowledge graph as page nodes + reference edges."""
    try:
        import asyncio
        import psycopg2
        from psycopg2.extras import RealDictCursor

        loop = asyncio.get_event_loop()

        def _load():
            conn = psycopg2.connect(settings.DATABASE_URL)
            try:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(
                        "SELECT subject, predicate, object, source_slug FROM wiki_triples WHERE knowledge_base_id = %s",
                        (kb_id,),
                    )
                    triples = [dict(r) for r in cur.fetchall()]
                    cur.execute(
                        "SELECT slug, title, page_type FROM wiki_pages WHERE knowledge_base_id = %s",
                        (kb_id,),
                    )
                    pages = {r['slug']: dict(r) for r in cur.fetchall()}
                return triples, pages
            finally:
                conn.close()

        triples, pages = await loop.run_in_executor(None, _load)
        return _triples_to_graph(triples, len(triples), pages)

    except Exception as exc:
        logger.error("Graph get error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


def _triples_to_graph(triples: list, triple_count: int, pages: dict = None) -> GraphResponse:
    """Convert list of triple dicts to GraphResponse with nodes + edges.
    pages: dict of slug -> {slug, title, page_type} for label resolution.
    All known pages are included as nodes even if they have no edges.
    """
    node_degree: dict = {}  # slug -> inbound+outbound edge count
    edges = []
    for t in triples:
        subj = t['subject']
        obj = t['object']
        pred = t['predicate']
        node_degree[subj] = node_degree.get(subj, 0) + 1
        node_degree[obj] = node_degree.get(obj, 0) + 1
        edges.append(GraphEdge(source=subj, target=obj, label=pred))

    # Include all known pages as nodes (even isolated ones with no edges)
    if pages:
        for slug in pages:
            if slug not in node_degree:
                node_degree[slug] = 0

    nodes = []
    for slug, degree in node_degree.items():
        if pages and slug in pages:
            p = pages[slug]
            label = p['title']
            ntype = p.get('page_type', 'entity')
        else:
            label = slug
            ntype = 'entity'
        nodes.append(GraphNode(id=slug, label=label, type=ntype, size=max(degree, 1)))

    return GraphResponse(nodes=nodes, edges=edges, triple_count=triple_count)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _slugify(text: str) -> str:
    """Convert text to URL-safe slug. Falls back to md5 hash for CJK-only titles."""
    import hashlib
    s = text.strip()
    slug = re.sub(r"[^\w\s-]", "", s.lower())
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug).strip("-")[:80]
    if not slug or len(slug) < 2:
        # CJK or symbol-only text: use short hash
        slug = "p-" + hashlib.md5(s.encode("utf-8")).hexdigest()[:12]
    return slug

