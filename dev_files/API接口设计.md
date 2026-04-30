# GeniusFlow API 接口设计

版本：V1.0（MVP）
协议：RESTful + WebSocket
认证：JWT Bearer Token
格式：JSON

---

## 1. 接口概览

| 模块 | 前缀 | 说明 |
|------|------|------|
| 认证 | `/api/v1/auth` | 登录、注册、Token 刷新 |
| 用户 | `/api/v1/users` | 用户管理、角色查询 |
| 流程定义 | `/api/v1/process-definitions` | 流程 CRUD、发布、版本管理 |
| 节点定义 | `/api/v1/node-definitions` | 节点配置（输入/行动/输出/AI） |
| 流程实例 | `/api/v1/process-instances` | 实例化、状态查询、终止 |
| 节点实例 | `/api/v1/node-instances` | 节点执行、提交、进度更新 |
| 任务 | `/api/v1/tasks` | 待办列表、审批操作 |
| 知识库 | `/api/v1/knowledge-bases` | 知识库 CRUD、文档管理 |
| AI | `/api/v1/ai` | AI 报告查询、配置 |
| 进度 | `/api/v1/progress` | 甘特图数据、预警 |
| 模板 | `/api/v1/templates` | 模板列表、复制 |
| 通知 | `/api/v1/notifications` | 通知列表、已读标记 |
| 上传 | `/api/v1/upload` | 文件上传 |
| WebSocket | `/ws` | 实时推送（AI 结果、通知） |

---

## 2. 通用规范

### 2.1 请求/响应格式

```typescript
// 成功响应
interface ApiResponse<T> {
  code: 0;
  data: T;
  message: 'success';
}

// 错误响应
interface ApiError {
  code: number;      // 业务错误码
  data: null;
  message: string;   // 错误描述
}

// 分页响应
interface PaginatedResponse<T> {
  code: 0;
  data: {
    list: T[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  };
  message: 'success';
}
```

### 2.2 HTTP 状态码

| 状态码 | 场景 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未认证/Token 过期 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 409 | 资源冲突（如重复发布） |
| 422 | 业务校验失败（如督导拦截） |
| 429 | 请求过于频繁 |
| 500 | 服务器内部错误 |

### 2.3 认证方式

```http
Authorization: Bearer <jwt_token>
```

Token 有效期：access_token 2 小时，refresh_token 7 天。

---

## 3. 核心接口详情

### 3.1 认证模块

#### POST /api/v1/auth/login
用户登录

**请求：**
```json
{
  "email": "user@example.com",
  "password": "string"
}
```

**响应：**
```json
{
  "code": 0,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 7200,
    "user": {
      "id": "uuid",
      "name": "张三",
      "email": "user@example.com",
      "roles": ["employee", "manager"]
    }
  },
  "message": "success"
}
```

#### POST /api/v1/auth/refresh
刷新 Token

**请求：**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

---

### 3.2 流程定义模块

#### GET /api/v1/process-definitions
流程定义列表

**查询参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| status | string | 否 | draft/published/archived |
| keyword | string | 否 | 名称模糊搜索 |
| page | number | 否 | 默认 1 |
| pageSize | number | 否 | 默认 20，最大 100 |

**响应：**
```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": "uuid",
        "name": "咨询项目标准流程",
        "version": 1,
        "status": "published",
        "nodeCount": 5,
        "createdBy": { "id": "uuid", "name": "张三" },
        "createdAt": "2026-04-30T10:00:00Z",
        "updatedAt": "2026-04-30T10:00:00Z"
      }
    ],
    "pagination": { "page": 1, "pageSize": 20, "total": 15, "totalPages": 1 }
  },
  "message": "success"
}
```

#### POST /api/v1/process-definitions
创建流程定义（草稿）

**请求：**
```json
{
  "name": "咨询项目标准流程",
  "graphJson": {
    "nodes": [
      { "id": "start", "type": "start", "position": { "x": 100, "y": 100 } },
      { "id": "node-1", "type": "task", "position": { "x": 300, "y": 100 } },
      { "id": "end", "type": "end", "position": { "x": 500, "y": 100 } }
    ],
    "edges": [
      { "id": "e1", "source": "start", "target": "node-1" },
      { "id": "e2", "source": "node-1", "target": "end" }
    ]
  }
}
```

#### GET /api/v1/process-definitions/:id
流程定义详情（含节点列表）

**响应：**
```json
{
  "code": 0,
  "data": {
    "id": "uuid",
    "name": "咨询项目标准流程",
    "version": 1,
    "status": "draft",
    "graphJson": { /* ... */ },
    "nodes": [
      {
        "id": "uuid",
        "nodeName": "需求调研",
        "nodeType": "task",
        "inputSpec": { /* ... */ },
        "actionSpec": { /* ... */ },
        "outputSpec": { /* ... */ },
        "aiConfig": { /* ... */ },
        "progressConfig": { /* ... */ },
        "sortOrder": 1
      }
    ],
    "createdAt": "2026-04-30T10:00:00Z"
  },
  "message": "success"
}
```

#### POST /api/v1/process-definitions/:id/publish
发布流程定义

> 发布后生成新版本，原版本不可编辑

**响应：**
```json
{
  "code": 0,
  "data": {
    "id": "uuid",
    "version": 1,
    "status": "published"
  },
  "message": "success"
}
```

**错误：**
- `409`：流程节点不完整，无法发布
- `409`：流程没有开始/结束节点

---

### 3.3 节点定义模块

#### PUT /api/v1/node-definitions/:id
更新节点配置

**请求：**
```json
{
  "nodeName": "需求调研",
  "inputSpec": {
    "dataSchema": [
      { "name": "客户名称", "type": "text", "required": true },
      { "name": "需求文档", "type": "file", "required": true }
    ],
    "acceptanceCriteria": "必须包含至少3个痛点描述",
    "source": "manual",
    "timeConstraint": { "daysFromStart": 2 }
  },
  "actionSpec": {
    "instructions": "1. 与客户进行深度访谈...",
    "requirements": "访谈时长不少于30分钟",
    "aiAssistance": ["inspector"],
    "timeConstraint": { "estimatedDays": 1 }
  },
  "outputSpec": {
    "deliverables": ["需求调研报告"],
    "qualityStandard": "报告不少于2000字",
    "acceptanceCondition": "包含需求优先级排序",
    "timeConstraint": { "daysFromStart": 3 }
  },
  "aiConfig": {
    "inspector": {
      "enabled": true,
      "mode": "strict",
      "promptTemplate": "请检查以下需求调研报告...",
      "knowledgeBaseId": "uuid"
    },
    "assistant": {
      "enabled": true,
      "promptTemplate": "请为管理者生成审批摘要..."
    }
  },
  "progressConfig": {
    "plannedDuration": 3,
    "isMilestone": false,
    "needApproval": true,
    "requireAiReportBeforeApproval": true
  }
}
```

**约束：**
- 只有 `status = draft` 的流程定义才能修改节点
- `nodeType` 不可修改

---

### 3.4 流程实例模块

#### POST /api/v1/process-instances
创建流程实例

**请求：**
```json
{
  "definitionId": "uuid",
  "plannedStartDate": "2026-05-01",
  "nodeAssignees": {
    "node-1": { "assigneeUserId": "uuid", "responsibleUserId": "uuid" },
    "node-2": { "assigneeUserId": "uuid", "responsibleUserId": "uuid" }
  }
}
```

**响应：**
```json
{
  "code": 0,
  "data": {
    "id": "uuid",
    "definitionId": "uuid",
    "status": "running",
    "plannedStartDate": "2026-05-01",
    "actualStartDate": "2026-04-30T10:00:00Z",
    "currentNodeId": "uuid",
    "nodes": [
      {
        "id": "uuid",
        "definitionId": "uuid",
        "status": "in_progress",
        "nodeName": "需求调研",
        "plannedStartDate": "2026-05-01",
        "plannedEndDate": "2026-05-04",
        "assignee": { "id": "uuid", "name": "李四" }
      }
    ],
    "createdAt": "2026-04-30T10:00:00Z"
  },
  "message": "success"
}
```

#### GET /api/v1/process-instances/:id
流程实例详情

**响应：** 含完整节点实例列表、当前节点高亮

#### POST /api/v1/process-instances/:id/terminate
终止流程实例

**请求：**
```json
{
  "reason": "客户需求变更，项目取消"
}
```

**约束：**
- 只有 `status = running` 的实例可以终止
- 终止后所有待办任务自动取消

---

### 3.5 节点实例模块

#### GET /api/v1/node-instances/:id
节点实例详情（员工执行界面数据）

**响应：**
```json
{
  "code": 0,
  "data": {
    "id": "uuid",
    "instanceId": "uuid",
    "definitionId": "uuid",
    "status": "in_progress",
    "nodeName": "需求调研",
    "inputData": {
      "fields": [
        { "name": "客户名称", "value": "ABC公司", "type": "text" },
        { "name": "需求文档", "value": "https://...", "type": "file" }
      ]
    },
    "outputData": {
      "fields": [
        { "name": "需求调研报告", "value": null, "type": "file" }
      ]
    },
    "actionSpec": { /* 节点配置的行动说明 */ },
    "aiConfig": { /* 节点 AI 配置 */ },
    "aiReport": { /* 最近一次 AI 报告 */ },
    "percentComplete": 50,
    "plannedStartDate": "2026-05-01",
    "plannedEndDate": "2026-05-04",
    "history": [
      { "eventType": "submit", "actor": "李四", "createdAt": "2026-05-02T10:00:00Z" }
    ]
  },
  "message": "success"
}
```

#### POST /api/v1/node-instances/:id/save
保存节点数据（草稿）

**请求：**
```json
{
  "inputData": { /* ... */ },
  "outputData": { /* ... */ },
  "percentComplete": 60
}
```

> 保存操作不触发 AI 督导，仅更新数据

#### POST /api/v1/node-instances/:id/submit
提交节点（触发 AI 督导）

**请求：**
```json
{
  "inputData": { /* ... */ },
  "outputData": { /* ... */ },
  "percentComplete": 100
}
```

**响应（督导通过）：**
```json
{
  "code": 0,
  "data": {
    "status": "pending_approval",
    "aiReport": {
      "passed": true,
      "score": 92,
      "issues": []
    },
    "message": "AI 督导通过，已提交审批"
  },
  "message": "success"
}
```

**响应（督导拦截）：**
```http
HTTP/1.1 422 Unprocessable Entity
```
```json
{
  "code": 422001,
  "data": null,
  "message": "AI 督导未通过",
  "details": {
    "aiReport": {
      "passed": false,
      "score": 65,
      "issues": [
        { "type": "error", "field": "痛点描述", "message": "仅找到 2 个痛点描述，需要至少 3 个" },
        { "type": "warning", "field": "需求文档", "message": "建议补充竞品分析" }
      ]
    }
  }
}
```

**响应（AI 超时降级）：**
```json
{
  "code": 0,
  "data": {
    "status": "pending_approval",
    "aiReport": null,
    "warning": "AI 校验超时，已降级处理",
    "isFallback": true
  },
  "message": "success"
}
```

#### POST /api/v1/node-instances/:id/progress
更新进度百分比

**请求：**
```json
{
  "percentComplete": 75
}
```

---

### 3.6 任务模块

#### GET /api/v1/tasks
我的任务列表

**查询参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | string | 否 | execute/approve，不传则全部 |
| status | string | 否 | pending/in_progress/completed |
| page | number | 否 | 默认 1 |
| pageSize | number | 否 | 默认 20 |

**响应：**
```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": "uuid",
        "nodeInstanceId": "uuid",
        "processInstanceId": "uuid",
        "processName": "咨询项目标准流程",
        "nodeName": "需求调研",
        "type": "execute",
        "status": "pending",
        "dueDate": "2026-05-04T00:00:00Z",
        "remainingDays": 2,
        "aiSummary": "AI 提醒：距离截止时间还有 2 天",
        "createdAt": "2026-05-01T00:00:00Z"
      }
    ],
    "pagination": { /* ... */ }
  },
  "message": "success"
}
```

#### POST /api/v1/tasks/:id/approve
审批通过

**请求：**
```json
{
  "comment": "质量达标，同意通过"
}
```

#### POST /api/v1/tasks/:id/reject
审批驳回

**请求：**
```json
{
  "comment": "痛点描述不够深入，请补充"
}
```

**约束：**
- 驳回后节点状态回到 `in_progress`
- 员工需重新修改后提交

---

### 3.7 知识库模块

#### GET /api/v1/knowledge-bases
知识库列表

#### POST /api/v1/knowledge-bases
创建知识库

**请求：**
```json
{
  "name": "咨询项目标准规范",
  "type": "standard",
  "description": "存放咨询项目的质量标准和验收规范"
}
```

#### POST /api/v1/knowledge-bases/:id/documents
上传文档

**请求：** multipart/form-data
```
file: <File>
```

**约束：**
- 支持 PDF、DOCX、TXT
- 单文件最大 50MB
- 自动触发解析和向量化任务

#### GET /api/v1/knowledge-bases/:id/documents
文档列表

**响应：**
```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": "uuid",
        "fileName": "咨询项目质量标准.pdf",
        "fileSize": 2048000,
        "parseStatus": "completed",
        "vectorizedStatus": "completed",
        "chunkCount": 45,
        "createdAt": "2026-04-30T10:00:00Z"
      }
    ]
  },
  "message": "success"
}
```

#### POST /api/v1/knowledge-bases/:id/documents/:docId/reindex
重新向量化

> 文档内容更新后触发

---

### 3.8 AI 模块

#### GET /api/v1/ai/reports/:nodeInstanceId
查询 AI 报告

**响应：**
```json
{
  "code": 0,
  "data": {
    "inspectorReport": {
      "passed": true,
      "score": 92,
      "issues": [],
      "createdAt": "2026-05-02T10:00:00Z"
    },
    "assistantReport": {
      "recommendation": "approve",
      "confidence": 88,
      "summary": "该节点输出质量良好...",
      "risks": ["交付时间略紧张"],
      "createdAt": "2026-05-02T10:05:00Z"
    }
  },
  "message": "success"
}
```

---

### 3.9 进度模块

#### GET /api/v1/progress/gantt/:processInstanceId
甘特图数据

**响应：**
```json
{
  "code": 0,
  "data": {
    "processName": "咨询项目标准流程",
    "startDate": "2026-05-01",
    "nodes": [
      {
        "id": "uuid",
        "name": "需求调研",
        "plannedStart": "2026-05-01",
        "plannedEnd": "2026-05-04",
        "actualStart": "2026-05-01",
        "actualEnd": null,
        "percentComplete": 75,
        "status": "in_progress"
      }
    ]
  },
  "message": "success"
}
```

#### GET /api/v1/progress/alerts
进度预警列表（管理者首页）

**响应：**
```json
{
  "code": 0,
  "data": {
    "overdueCount": 3,
    "atRiskCount": 5,
    "alerts": [
      {
        "type": "overdue",
        "nodeInstanceId": "uuid",
        "nodeName": "需求调研",
        "processName": "咨询项目标准流程",
        "plannedEndDate": "2026-05-04",
        "daysOverdue": 2,
        "assignee": "李四"
      }
    ]
  },
  "message": "success"
}
```

---

### 3.10 模板模块

#### GET /api/v1/templates
模板列表

**响应：**
```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": "uuid",
        "name": "咨询项目标准流程",
        "description": "适用于 IT 咨询项目的标准交付流程",
        "category": "咨询",
        "nodeCount": 5,
        "isPreset": true
      }
    ]
  },
  "message": "success"
}
```

#### POST /api/v1/templates/:id/clone
复制模板到我的流程

**响应：** 返回新创建的流程定义 ID

---

### 3.11 上传模块

#### POST /api/v1/upload
通用文件上传

**请求：** multipart/form-data
```
file: <File>
```

**响应：**
```json
{
  "code": 0,
  "data": {
    "url": "https://minio.example.com/files/uuid-filename.pdf",
    "fileName": "filename.pdf",
    "fileSize": 2048000,
    "mimeType": "application/pdf"
  },
  "message": "success"
}
```

---

## 4. WebSocket 接口

### 4.1 连接方式

```
ws://api.example.com/ws?token=<jwt_token>
```

### 4.2 消息格式

```typescript
interface WsMessage {
  type: 'ai_inspection_result' | 'notification' | 'task_update' | 'ping';
  payload: any;
  timestamp: string;
}
```

### 4.3 消息类型

#### ai_inspection_result
AI 督导结果推送

```json
{
  "type": "ai_inspection_result",
  "payload": {
    "nodeInstanceId": "uuid",
    "result": {
      "passed": true,
      "score": 92,
      "issues": []
    }
  },
  "timestamp": "2026-05-02T10:00:00Z"
}
```

#### notification
实时通知

```json
{
  "type": "notification",
  "payload": {
    "id": "uuid",
    "title": "新审批任务",
    "content": "李四提交了"需求调研"节点，等待您的审批",
    "relatedResourceType": "task",
    "relatedResourceId": "uuid"
  },
  "timestamp": "2026-05-02T10:00:00Z"
}
```

#### task_update
任务状态更新

```json
{
  "type": "task_update",
  "payload": {
    "taskId": "uuid",
    "status": "completed",
    "nodeInstanceId": "uuid"
  },
  "timestamp": "2026-05-02T10:00:00Z"
}
```

---

## 5. 错误码定义

| 错误码 | 说明 | HTTP 状态码 |
|--------|------|-------------|
| 0 | 成功 | 200 |
| 400001 | 请求参数错误 | 400 |
| 400002 | JSON 格式错误 | 400 |
| 401001 | Token 过期 | 401 |
| 401002 | Token 无效 | 401 |
| 403001 | 无权限访问 | 403 |
| 404001 | 资源不存在 | 404 |
| 409001 | 流程已发布，不可编辑 | 409 |
| 409002 | 流程节点不完整 | 409 |
| 422001 | AI 督导未通过 | 422 |
| 422002 | 审批意见不能为空 | 422 |
| 429001 | 请求过于频繁 | 429 |
| 500001 | 服务器内部错误 | 500 |
| 500002 | AI 服务调用失败 | 500 |
| 500003 | 文件上传失败 | 500 |

---

## 6. 接口权限矩阵

| 接口 | designer | employee | manager | admin |
|------|----------|----------|---------|-------|
| POST /process-definitions | ✓ | ✗ | ✗ | ✓ |
| PUT /node-definitions/:id | ✓ | ✗ | ✗ | ✓ |
| POST /process-definitions/:id/publish | ✓ | ✗ | ✗ | ✓ |
| GET /tasks | ✓ | ✓ | ✓ | ✓ |
| POST /node-instances/:id/submit | ✗ | ✓ | ✗ | ✓ |
| POST /tasks/:id/approve | ✗ | ✗ | ✓ | ✓ |
| GET /progress/alerts | ✗ | ✗ | ✓ | ✓ |
| GET /knowledge-bases | ✗ | ✗ | ✗ | ✓ |
| POST /knowledge-bases | ✗ | ✗ | ✗ | ✓ |
| GET /templates | ✓ | ✓ | ✓ | ✓ |
| GET /users | ✗ | ✗ | ✗ | ✓ |
| POST /users | ✗ | ✗ | ✗ | ✓ |

> 注：admin 拥有所有权限；employee 只能查看和执行分配给自己的任务
