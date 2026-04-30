# GeniusFlow AI 服务设计

版本：V1.0（MVP）
对应 PRD：产品需求文档 V1.0 - 第 4.3 节

---

## 1. 服务架构

```
┌─────────────────────────────────────────────────────────────┐
│                      AI Service (FastAPI)                   │
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │  Inspector  │    │  Assistant  │    │   RAG       │     │
│  │   Agent     │    │   Agent     │    │  Module     │     │
│  │             │    │             │    │             │     │
│  │ · 完整性检查 │    │ · 审批摘要  │    │ · 文档解析  │     │
│  │ · 质量评估   │    │ · 风险评估  │    │ · 分块切分  │     │
│  │ · 修改建议   │    │ · 决策建议  │    │ · 向量检索  │     │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘     │
│         │                  │                  │             │
│         └──────────────────┼──────────────────┘             │
│                            ▼                                │
│                   ┌─────────────────┐                       │
│                   │  Prompt Engine  │                       │
│                   │  · 模板管理      │                       │
│                   │  · 变量注入      │                       │
│                   │  · 上下文组装    │                       │
│                   └────────┬────────┘                       │
│                            ▼                                │
│                   ┌─────────────────┐                       │
│                   │  LLM Client     │                       │
│                   │  · OpenAI API   │                       │
│                   │  · 超时控制      │                       │
│                   │  · 重试机制      │                       │
│                   │  · 降级策略      │                       │
│                   └─────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 模型选型

| 用途 | 模型 | 理由 | 预估成本 |
|------|------|------|----------|
| 督导 (Inspector) | GPT-4o-mini | 结构化输出稳定，成本低 | ~$0.15/次 |
| 审批助理 (Assistant) | GPT-4o-mini | 摘要生成质量好 | ~$0.15/次 |
| Embedding | text-embedding-3-small | 1536 维，检索效果够用 | ~$0.02/1M tokens |

> 成本估算：500 次调用/天 × $0.15 = $75/天 ≈ **$300/月**（督导）
> 审批助理按 100 次/天 ≈ **$60/月**
> 合计约 **$360-$800/月**

---

## 3. 督导 Agent (Inspector)

### 3.1 输入

```typescript
interface InspectorInput {
  nodeName: string;
  inputData: Record<string, any>;
  outputData: Record<string, any>;
  acceptanceCriteria: string;      // 验收标准（来自节点配置）
  qualityStandard: string;         // 质量标准
  knowledgeBaseChunks: string[];   // 检索到的知识库片段
}
```

### 3.2 Prompt 模板

```
你是一位严格的流程质量督导员。请根据以下信息检查节点输出质量。

## 节点信息
节点名称：{{nodeName}}

## 验收标准
{{acceptanceCriteria}}

## 质量标准
{{qualityStandard}}

## 节点输入数据
{{inputData}}

## 节点输出数据
{{outputData}}

## 参考规范（来自知识库）
{{knowledgeBaseChunks}}

## 检查要求
1. 对照验收标准，检查输出是否满足每一项要求
2. 对照质量标准，评估输出质量
3. 如有知识库参考，检查是否符合规范
4. 给出具体的修改建议

## 输出格式（必须严格遵循 JSON Schema）
{
  "passed": boolean,      // true: 通过, false: 不通过
  "score": number,        // 0-100 质量评分
  "issues": [
    {
      "type": "error|warning",    // error: 必须修改; warning: 建议修改
      "field": string,            // 相关字段
      "message": string,          // 具体问题描述
      "suggestion": string        // 修改建议
    }
  ],
  "summary": string       // 总体评价（50字以内）
}

注意：
- 只要有一个 error 类型的问题，passed 必须为 false
- score 低于 60 分时，passed 必须为 false
- 必须返回合法的 JSON，不要包含任何其他内容
```

### 3.3 输出 Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["passed", "score", "issues", "summary"],
  "properties": {
    "passed": { "type": "boolean" },
    "score": { "type": "number", "minimum": 0, "maximum": 100 },
    "issues": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["type", "field", "message"],
        "properties": {
          "type": { "type": "string", "enum": ["error", "warning"] },
          "field": { "type": "string" },
          "message": { "type": "string" },
          "suggestion": { "type": "string" }
        }
      }
    },
    "summary": { "type": "string", "maxLength": 100 }
  }
}
```

### 3.4 调用流程

```
员工提交节点
    │
    ▼
┌─────────────┐
│  主服务接收  │
│  提交请求    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 写入数据库   │
│ status =    │
│ ai_inspecting│
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 发送 Bull   │
│ 异步任务    │
└──────┬──────┘
       │
       ▼
┌─────────────┐     超时 10s
│ AI Service  │ ──────────▶ 降级处理
│ 执行督导    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 解析 JSON   │     解析失败
│ 输出        │ ──────────▶ 重试1次，再失败则降级
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 保存结果到   │
│ ai_reports  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ WebSocket   │
│ 推送结果    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 更新节点状态 │
│ 通过 →      │
│ pending_approval
│ 不通过 →    │
│ in_progress │
└─────────────┘
```

### 3.5 降级策略

| 场景 | 行为 | 标记 |
|------|------|------|
| AI 调用超时 (10s) | 强制校验模式降级为"仅提醒"，允许提交 | `is_fallback = true` |
| JSON 解析失败 | 重试 1 次，仍失败则降级 | `is_fallback = true` |
| AI API 异常 | 直接降级 | `is_fallback = true` |
| 知识库为空 | 基于通用能力检查，不报错 | `is_fallback = false` |

---

## 4. 审批助理 Agent (Assistant)

### 4.1 输入

```typescript
interface AssistantInput {
  nodeName: string;
  inputData: Record<string, any>;
  outputData: Record<string, any>;
  actionRecords: string;           // 员工行动记录
  inspectorReport: object;         // 督导报告
  knowledgeBaseChunks: string[];   // 检索到的知识库片段
}
```

### 4.2 Prompt 模板

```
你是一位管理者的智能审批助理。请根据以下信息生成审批建议报告。

## 节点信息
节点名称：{{nodeName}}

## 节点输入数据
{{inputData}}

## 员工行动记录
{{actionRecords}}

## 节点输出数据
{{outputData}}

## AI 督导报告
{{inspectorReport}}

## 参考知识
{{knowledgeBaseChunks}}

## 输出要求
1. 总结节点执行的核心内容
2. 评估输出质量（基于督导报告）
3. 识别潜在风险
4. 给出审批建议

## 输出格式（必须严格遵循 JSON Schema）
{
  "recommendation": "approve|reject",    // 建议通过或驳回
  "confidence": number,                   // 0-100 置信度
  "summary": string,                      // 内容摘要（100字以内）
  "quality": {
    "score": number,                      // 质量评分
    "strengths": [string],                // 优点列表
    "weaknesses": [string]                // 不足列表
  },
  "risks": [                              // 风险点列表
    {
      "level": "high|medium|low",
      "description": string
    }
  ],
  "suggestion": string                    // 给管理者的建议
}

注意：
- confidence 低于 50 时，recommendation 建议为 reject
- 必须返回合法的 JSON，不要包含任何其他内容
```

### 4.3 输出 Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["recommendation", "confidence", "summary", "quality", "risks"],
  "properties": {
    "recommendation": { "type": "string", "enum": ["approve", "reject"] },
    "confidence": { "type": "number", "minimum": 0, "maximum": 100 },
    "summary": { "type": "string", "maxLength": 200 },
    "quality": {
      "type": "object",
      "required": ["score", "strengths", "weaknesses"],
      "properties": {
        "score": { "type": "number", "minimum": 0, "maximum": 100 },
        "strengths": { "type": "array", "items": { "type": "string" } },
        "weaknesses": { "type": "array", "items": { "type": "string" } }
      }
    },
    "risks": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["level", "description"],
        "properties": {
          "level": { "type": "string", "enum": ["high", "medium", "low"] },
          "description": { "type": "string" }
        }
      }
    },
    "suggestion": { "type": "string" }
  }
}
```

---

## 5. RAG 检索模块

### 5.1 文档处理流程

```
上传文档
    │
    ▼
┌─────────────┐
│ 文件校验    │
│ · 类型检查  │
│ · 大小检查  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 文本提取    │
│ · PDF:      │
│   pdfplumber│
│ · DOCX:     │
│   python-docx
│ · TXT:      │
│   直接读取  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 文本分块    │
│ · 按段落    │
│ · 最大 500  │
│   tokens    │
│ · 重叠 50   │
│   tokens    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Embedding   │
│ text-       │
│ embedding-  │
│ 3-small     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 存入        │
│ document_   │
│ chunks      │
│ (pgvector)  │
└─────────────┘
```

### 5.2 检索流程

```python
async def retrieve_relevant_chunks(
    query: str,
    knowledge_base_id: str,
    top_k: int = 3,
    similarity_threshold: float = 0.7
) -> list[str]:
    """
    检索相关知识库片段
    """
    # 1. 对查询进行 embedding
    query_embedding = await openai.embeddings.create(
        model="text-embedding-3-small",
        input=query
    )
    
    # 2. 向量相似度检索
    results = await db.query("""
        SELECT content, 1 - (embedding <=> $1) as similarity
        FROM document_chunks
        WHERE document_id IN (
            SELECT id FROM knowledge_base_documents
            WHERE knowledge_base_id = $2
            AND vectorized_status = 'completed'
        )
        AND 1 - (embedding <=> $1) > $3
        ORDER BY embedding <=> $1
        LIMIT $4
    """, query_embedding, knowledge_base_id, similarity_threshold, top_k)
    
    return [r.content for r in results]
```

### 5.3 知识库挂载优先级

```
节点提交/审批时
    │
    ▼
检查节点是否配置了 knowledgeBaseId
    │
    ├── 有 ──▶ 使用该节点配置的知识库
    │
    └── 无 ──▶ 检查流程是否配置了 knowledgeBaseId
                  │
                  ├── 有 ──▶ 使用流程级知识库
                  │
                  └── 无 ──▶ 不使用知识库（基于通用能力）
```

---

## 6. API 接口

### 6.1 POST /ai/inspect
督导检查

**请求：**
```json
{
  "nodeInstanceId": "uuid",
  "nodeName": "需求调研",
  "inputData": { /* ... */ },
  "outputData": { /* ... */ },
  "acceptanceCriteria": "必须包含至少3个痛点描述",
  "qualityStandard": "报告不少于2000字",
  "knowledgeBaseId": "uuid"
}
```

**响应：**
```json
{
  "passed": true,
  "score": 92,
  "issues": [],
  "summary": "输出质量良好，符合验收标准"
}
```

### 6.2 POST /ai/assist
审批助理

**请求：**
```json
{
  "nodeInstanceId": "uuid",
  "nodeName": "需求调研",
  "inputData": { /* ... */ },
  "outputData": { /* ... */ },
  "actionRecords": "员工于 2026-05-01 开始执行...",
  "inspectorReport": { /* ... */ },
  "knowledgeBaseId": "uuid"
}
```

**响应：**
```json
{
  "recommendation": "approve",
  "confidence": 88,
  "summary": "需求调研报告内容完整...",
  "quality": {
    "score": 85,
    "strengths": ["痛点分析深入", "需求优先级清晰"],
    "weaknesses": ["竞品分析部分较简略"]
  },
  "risks": [
    { "level": "low", "description": "交付时间略紧张" }
  ],
  "suggestion": "建议通过，但需关注后续交付进度"
}
```

### 6.3 POST /ai/embedding
文本向量化（内部接口）

### 6.4 POST /ai/retrieve
知识库检索（内部接口）

---

## 7. 异常处理

| 异常 | 处理 | 日志 |
|------|------|------|
| OpenAI API 超时 | 降级，返回空结果 | ERROR |
| OpenAI API 限流 | 指数退避重试，最多 3 次 | WARN |
| JSON 解析失败 | 重试 1 次，再失败降级 | WARN |
| 知识库检索为空 | 继续执行，不使用知识库 | INFO |
| Embedding 失败 | 标记文档解析失败 | ERROR |

---

## 8. 监控指标

| 指标 | 类型 | 告警阈值 |
|------|------|----------|
| AI 调用延迟 (P99) | Histogram | > 8s |
| AI 调用失败率 | Counter | > 5% |
| 降级调用比例 | Counter | > 10% |
| 平均 Token 消耗 | Histogram | - |
| 知识库检索延迟 | Histogram | > 500ms |
| 向量检索 Top-K 命中率 | Gauge | < 80% |
