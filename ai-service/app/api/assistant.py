from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
import json
import asyncio
from openai import AsyncOpenAI

from app.core.config import settings

router = APIRouter()
client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


class Risk(BaseModel):
    level: str = Field(..., pattern="^(high|medium|low)$")
    description: str


class Quality(BaseModel):
    score: int = Field(..., ge=0, le=100)
    strengths: List[str]
    weaknesses: List[str]


class AssistantResult(BaseModel):
    recommendation: str = Field(..., pattern="^(approve|reject)$")
    confidence: int = Field(..., ge=0, le=100)
    summary: str = Field(..., max_length=200)
    quality: Quality
    risks: List[Risk]
    suggestion: Optional[str] = None


class AssistantRequest(BaseModel):
    nodeName: str
    inputData: dict
    outputData: dict
    actionRecords: str
    inspectorReport: Optional[dict] = None
    knowledgeBaseChunks: List[str] = []


ASSISTANT_PROMPT_TEMPLATE = """你是一位管理者的智能审批助理。请根据以下信息生成审批建议报告。

## 节点信息
节点名称：{node_name}

## 节点输入数据
{input_data}

## 员工行动记录
{action_records}

## 节点输出数据
{output_data}

## AI 督导报告
{inspector_report}

## 参考知识
{knowledge_base_chunks}

## 输出要求
1. 总结节点执行的核心内容
2. 评估输出质量（基于督导报告）
3. 识别潜在风险
4. 给出审批建议

## 输出格式（必须严格遵循 JSON Schema）
{{
  "recommendation": "approve|reject",
  "confidence": number,
  "summary": string,
  "quality": {{
    "score": number,
    "strengths": [string],
    "weaknesses": [string]
  }},
  "risks": [
    {{
      "level": "high|medium|low",
      "description": string
    }}
  ],
  "suggestion": string
}}

注意：
- confidence 低于 50 时，recommendation 建议为 reject
- 必须返回合法的 JSON，不要包含任何其他内容"""


@router.post("/assist", response_model=AssistantResult)
async def assist(request: AssistantRequest):
    try:
        prompt = ASSISTANT_PROMPT_TEMPLATE.format(
            node_name=request.nodeName,
            input_data=json.dumps(request.inputData, ensure_ascii=False, indent=2),
            action_records=request.actionRecords,
            output_data=json.dumps(request.outputData, ensure_ascii=False, indent=2),
            inspector_report=json.dumps(request.inspectorReport, ensure_ascii=False, indent=2) if request.inspectorReport else "无",
            knowledge_base_chunks="\n".join(request.knowledgeBaseChunks) if request.knowledgeBaseChunks else "无"
        )

        response = await asyncio.wait_for(
            client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": "你是一个管理者的智能审批助理，只输出合法的 JSON 格式。"},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                response_format={"type": "json_object"}
            ),
            timeout=10.0
        )

        result_text = response.choices[0].message.content
        result_dict = json.loads(result_text)

        return AssistantResult(**result_dict)

    except asyncio.TimeoutError:
        return AssistantResult(
            recommendation="approve",
            confidence=50,
            summary="AI 助理响应超时，建议人工审核",
            quality=Quality(score=0, strengths=[], weaknesses=["AI 助理超时"]),
            risks=[Risk(level="medium", description="AI 助理超时，审批建议可能不准确")],
            suggestion="请仔细审查节点输出内容"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI assistant failed: {str(e)}")
