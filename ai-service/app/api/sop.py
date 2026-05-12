"""
SOP Generator Agent

Generates a complete standard operating procedure (SOP) flow definition
from a natural-language description, streaming nodes one-by-one via SSE.
"""

import io
import json
import logging
import asyncio
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, Field

from app.api.knowledge import build_chat_client

router = APIRouter()
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class SopGenerateRequest(BaseModel):
    description: str = Field(..., min_length=5, description="业务场景描述（无长度上限）")
    domain: str = Field(default="通用", description="业务领域，如：软件研发、市场营销、采购管理")
    roleHints: List[str] = Field(default=[], description="涉及的角色/岗位提示")
    estimatedSteps: int = Field(default=6, ge=3, le=15, description="期望的节点数量（含开始/结束）")
    referenceContext: Optional[str] = Field(default=None, description="可选的参考上下文（如模板 JSON 摘要）")


# ---------------------------------------------------------------------------
# System Prompt
# ---------------------------------------------------------------------------

SOP_SYSTEM_PROMPT = """你是一位资深的业务流程设计专家，专注于标准化操作程序（SOP）的设计。
你将根据用户的描述，设计一个完整、可执行的业务流程。

## 输出规则
你必须严格输出一个 JSON 对象，包含以下字段：
- processName: 流程名称（简洁，10字以内）
- description: 流程简介（50字以内）
- nodes: 节点列表（数组）
- edges: 连线列表（数组）

## 节点格式
每个节点必须包含以下字段：
```json
{
  "id": "node_1",           // 唯一 ID，格式 node_N
  "type": "start|end|task|approval",  // 节点类型
  "label": "节点名称",       // 不超过 12 字
  "position": {"x": 150, "y": 200},  // 坐标，横向依次排列
  "assigneeRole": "角色名",  // 负责角色（start/end 节点留空）
  "dueHours": 48,           // 预计完成时间（小时）
  "enableAiInspection": true,   // 是否启用 AI 巡检（task 节点建议 true）
  "acceptanceCriteria": "验收标准描述",  // 具体验收标准
  "sopContent": "操作规范正文，描述员工在此步骤应如何正确操作，分步骤说明，每步换行，至少 3 步",  // task/approval 节点必填
  "checklist": [            // 执行检查清单（task/approval 节点，2-5 项）
    {"id": "c_1", "label": "检查项描述", "required": true}
  ],
  "inputFields": [          // 输入字段定义
    {"key": "field1", "label": "字段标签", "type": "textarea|text|file|select"}
  ],
  "outputFields": [         // 输出字段定义
    {"key": "output1", "label": "输出标签", "type": "textarea|text|file"}
  ]
}
```

## 节点布局规则
- 所有节点水平排列，y 坐标统一为 200
- x 坐标从 100 开始，每个节点间距 280px
- 开始节点 type=start，结束节点 type=end，审批节点 type=approval，其余 type=task
- 重要里程碑后应有 approval 节点
- 每个 task 节点最多 3 个输入字段、3 个输出字段

## 连线格式
```json
{"id": "edge_1_2", "source": "node_1", "target": "node_2"}
```

## 注意事项
- 必须有且只有一个 start 节点和一个 end 节点
- 节点按业务逻辑顺序线性排列
- task 节点的 acceptanceCriteria 要具体且可量化
- 角色名要符合企业实际岗位名称
- task 和 approval 节点必须填写 sopContent（操作规范），分步描述具体操作方法，不少于 3 步
- task 和 approval 节点必须提供 2-5 个 checklist 检查项，id 格式为 c_{nodeId}_N，required=true 表示必需完成
- 只输出 JSON，不要有任何其他文字"""


# ---------------------------------------------------------------------------
# Generator
# ---------------------------------------------------------------------------

async def _stream_sop_events(request: SopGenerateRequest):
    """Call LLM and stream SOP nodes/edges as SSE events."""

    role_hints = "、".join(request.roleHints) if request.roleHints else "根据业务场景自动分配"

    user_prompt = f"""请为以下业务场景设计一个标准 SOP 流程：

**业务领域**：{request.domain}
**场景描述**：{request.description}
**涉及角色**：{role_hints}
**期望节点数**：约 {request.estimatedSteps} 个节点（含开始和结束节点）
{f'**参考上下文**：{request.referenceContext}' if request.referenceContext else ''}

请设计完整的 SOP 流程，确保：
1. 覆盖业务的完整生命周期
2. 关键交付物有明确的验收标准
3. 重要节点有审批环节
4. 输入/输出字段切实可用
5. 每个 task/approval 节点的 sopContent 要针对该具体步骤写详细操作指南（分步骤，不少于3步）
6. 每个 task/approval 节点的 checklist 要列出该步骤完成时必须核验的关键检查项"""

    try:
        client, model_id = build_chat_client()

        response = await asyncio.wait_for(
            client.chat.completions.create(
                model=model_id,
                messages=[
                    {"role": "system", "content": SOP_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.7,
                response_format={"type": "json_object"},
            ),
            timeout=240.0,
        )

        result_text = response.choices[0].message.content
        data = json.loads(result_text)

        process_name = data.get("processName", "未命名SOP")
        description = data.get("description", "")
        nodes = data.get("nodes", [])
        edges = data.get("edges", [])

        # Stream each node
        for node in nodes:
            event_data = json.dumps({"type": "node", "data": node}, ensure_ascii=False)
            yield f"data: {event_data}\n\n"
            await asyncio.sleep(0.05)  # slight delay for UX

        # Stream edges
        for edge in edges:
            event_data = json.dumps({"type": "edge", "data": edge}, ensure_ascii=False)
            yield f"data: {event_data}\n\n"

        # Done event
        done_data = json.dumps(
            {
                "type": "done",
                "data": {
                    "processName": process_name,
                    "description": description,
                    "nodeCount": len(nodes),
                },
            },
            ensure_ascii=False,
        )
        yield f"data: {done_data}\n\n"

    except asyncio.TimeoutError:
        error_data = json.dumps({"type": "error", "data": {"message": "AI 生成超时，请重试"}}, ensure_ascii=False)
        yield f"data: {error_data}\n\n"
    except json.JSONDecodeError as e:
        logger.error("SOP JSON parse error: %s", e)
        error_data = json.dumps({"type": "error", "data": {"message": "AI 返回格式错误，请重试"}}, ensure_ascii=False)
        yield f"data: {error_data}\n\n"
    except Exception as e:
        logger.error("SOP generate error: %s", e)
        error_data = json.dumps({"type": "error", "data": {"message": f"生成失败：{str(e)}"}}, ensure_ascii=False)
        yield f"data: {error_data}\n\n"


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------

@router.post("/sop/generate")
async def generate_sop(request: SopGenerateRequest):
    """Generate a SOP flow definition from a natural-language description (SSE stream)."""
    return StreamingResponse(
        _stream_sop_events(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ---------------------------------------------------------------------------
# Text extraction from uploaded document
# ---------------------------------------------------------------------------

ALLOWED_EXTENSIONS = {".txt", ".md", ".pdf", ".docx"}


async def _extract_text_from_file(file: UploadFile) -> str:
    """Extract plain text from an uploaded txt/md/pdf/docx file."""
    import os
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail=f"不支持的文件格式 {ext}，请上传 txt / md / pdf / docx 文件",
        )

    content = await file.read()

    if ext in (".txt", ".md"):
        import chardet
        detected = chardet.detect(content)
        encoding = detected.get("encoding") or "utf-8"
        return content.decode(encoding, errors="replace")

    if ext == ".pdf":
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(content))
        pages = [page.extract_text() or "" for page in reader.pages]
        return "\n\n".join(pages)

    if ext == ".docx":
        from docx import Document
        doc = Document(io.BytesIO(content))
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        return "\n".join(paragraphs)

    return ""


@router.post("/sop/extract-text")
async def extract_text(file: UploadFile = File(...)):
    """Extract plain text from an uploaded txt / md / pdf / docx document."""
    text = await _extract_text_from_file(file)
    return JSONResponse({"text": text, "length": len(text)})
