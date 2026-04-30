from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
import json
import asyncio
from openai import AsyncOpenAI

from app.core.config import settings

router = APIRouter()
client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


class Issue(BaseModel):
    type: str = Field(..., pattern="^(error|warning)$")
    field: str
    message: str
    suggestion: Optional[str] = None


class InspectorResult(BaseModel):
    passed: bool
    score: int = Field(..., ge=0, le=100)
    issues: List[Issue]
    summary: str = Field(..., max_length=100)


class InspectorRequest(BaseModel):
    nodeName: str
    inputData: dict
    outputData: dict
    acceptanceCriteria: str
    qualityStandard: str
    knowledgeBaseChunks: List[str] = []


INSPECTOR_PROMPT_TEMPLATE = """你是一位严格的流程质量督导员。请根据以下信息检查节点输出质量。

## 节点信息
节点名称：{node_name}

## 验收标准
{acceptance_criteria}

## 质量标准
{quality_standard}

## 节点输入数据
{input_data}

## 节点输出数据
{output_data}

## 参考规范（来自知识库）
{knowledge_base_chunks}

## 检查要求
1. 对照验收标准，检查输出是否满足每一项要求
2. 对照质量标准，评估输出质量
3. 如有知识库参考，检查是否符合规范
4. 给出具体的修改建议

## 输出格式（必须严格遵循 JSON Schema）
{{
  "passed": boolean,
  "score": number,
  "issues": [
    {{
      "type": "error|warning",
      "field": string,
      "message": string,
      "suggestion": string
    }}
  ],
  "summary": string
}}

注意：
- 只要有一个 error 类型的问题，passed 必须为 false
- score 低于 60 分时，passed 必须为 false
- 必须返回合法的 JSON，不要包含任何其他内容"""


@router.post("/inspect", response_model=InspectorResult)
async def inspect(request: InspectorRequest):
    try:
        prompt = INSPECTOR_PROMPT_TEMPLATE.format(
            node_name=request.nodeName,
            acceptance_criteria=request.acceptanceCriteria,
            quality_standard=request.qualityStandard,
            input_data=json.dumps(request.inputData, ensure_ascii=False, indent=2),
            output_data=json.dumps(request.outputData, ensure_ascii=False, indent=2),
            knowledge_base_chunks="\n".join(request.knowledgeBaseChunks) if request.knowledgeBaseChunks else "无"
        )

        response = await asyncio.wait_for(
            client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": "你是一个流程质量督导员，只输出合法的 JSON 格式。"},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                response_format={"type": "json_object"}
            ),
            timeout=10.0
        )

        result_text = response.choices[0].message.content
        result_dict = json.loads(result_text)

        # 校验 score 和 passed 的一致性
        if result_dict.get("score", 100) < 60:
            result_dict["passed"] = False

        has_error = any(issue.get("type") == "error" for issue in result_dict.get("issues", []))
        if has_error:
            result_dict["passed"] = False

        return InspectorResult(**result_dict)

    except asyncio.TimeoutError:
        # 超时降级
        return InspectorResult(
            passed=True,
            score=0,
            issues=[Issue(type="warning", field="system", message="AI 校验超时，已降级处理")],
            summary="AI 校验超时，请人工审核"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI inspection failed: {str(e)}")
