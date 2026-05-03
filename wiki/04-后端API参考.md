# 后端 API 参考

## 一、基础说明

| 项目 | 值 |
|------|-----|
| Base URL（生产） | `http://localhost/api/v1` |
| Base URL（本地开发） | `http://localhost:4001/api/v1` |
| 内容类型 | `application/json` |
| 认证方式 | Bearer Token（JWT） |
| 统一响应格式 | `{ data: T, message: string, statusCode: number }` |

### 认证流程

```
POST /auth/login  →  获得 accessToken (2h) + refreshToken (7d)
Authorization: Bearer <accessToken>  →  访问受保护接口
POST /auth/refresh  →  使用 refreshToken 刷新 accessToken
POST /auth/logout  →  使注销 refreshToken
```

---

## 二、认证接口 `/auth`

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | `/auth/login` | 登录，返回 token 对 | 公开 |
| POST | `/auth/refresh` | 刷新 accessToken | 公开 |
| POST | `/auth/logout` | 登出 | 已登录 |
| GET | `/auth/me` | 获取当前用户信息 | 已登录 |

**登录请求**
```json
POST /auth/login
{
  "email": "admin@geniusflow.com",
  "password": "admin123"
}
```

**登录响应**
```json
{
  "data": {
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci...",
    "user": {
      "id": "clxxx",
      "email": "admin@geniusflow.com",
      "name": "系统管理员",
      "roles": ["admin"]
    }
  }
}
```

---

## 三、用户管理 `/users`

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/users` | 用户列表（分页） | admin |
| POST | `/users` | 创建用户 | admin |
| GET | `/users/:id` | 获取用户详情 | admin |
| PUT | `/users/:id` | 更新用户信息 | admin |
| DELETE | `/users/:id` | 删除用户 | admin |
| PUT | `/users/:id/roles` | 修改用户角色 | admin |

---

## 四、角色管理 `/roles`

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/roles` | 角色列表 | admin |
| POST | `/roles` | 创建角色 | admin |
| GET | `/roles/:id` | 角色详情 | admin |
| PUT | `/roles/:id` | 更新角色 | admin |
| DELETE | `/roles/:id` | 删除角色 | admin |

---

## 五、流程定义 `/process-definitions`

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/process-definitions` | 列表（分页，可按状态筛选） | 已登录 |
| POST | `/process-definitions` | 创建流程定义 | designer / admin |
| GET | `/process-definitions/:id` | 获取详情（含节点定义） | 已登录 |
| PUT | `/process-definitions/:id` | 更新流程（含画布 JSON） | designer / admin |
| DELETE | `/process-definitions/:id` | 删除（仅 draft 可删） | designer / admin |
| POST | `/process-definitions/:id/publish` | 发布流程 | designer / admin |
| POST | `/process-definitions/:id/archive` | 归档流程 | designer / admin |

---

## 六、节点定义 `/node-definitions`

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/node-definitions` | 按 processDefinitionId 查询 | 已登录 |
| POST | `/node-definitions` | 创建节点定义 | designer / admin |
| GET | `/node-definitions/:id` | 获取节点详情 | 已登录 |
| PUT | `/node-definitions/:id` | 更新节点定义 | designer / admin |
| DELETE | `/node-definitions/:id` | 删除节点定义 | designer / admin |

---

## 七、流程实例 `/process-instances`

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/process-instances` | 实例列表（分页、状态筛选） | 已登录 |
| POST | `/process-instances` | 创建流程实例 | designer / manager / admin |
| GET | `/process-instances/:id` | 实例详情 | 已登录 |
| POST | `/process-instances/:id/terminate` | 终止实例 | manager / admin |
| GET | `/process-instances/:id/gantt` | Gantt 图数据 | 已登录 |
| PUT | `/process-instances/:id/baseline` | 设定基线 | manager / admin |

**创建实例请求**
```json
POST /process-instances
{
  "processDefinitionId": "clxxx",
  "name": "2024年Q3质量审查",
  "plannedStartDate": "2024-07-01T00:00:00Z",
  "plannedEndDate": "2024-09-30T00:00:00Z"
}
```

---

## 八、节点实例 `/node-instances`

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/node-instances/:id` | 节点实例详情 | 已登录 |
| POST | `/node-instances/:id/save` | 保存草稿（不触发 AI 巡检） | 已登录 |
| POST | `/node-instances/:id/submit` | 提交（触发 AI 巡检 + 审批任务） | 已登录 |
| POST | `/node-instances/:id/progress` | 更新进度（0-100） | 已登录 |

**提交节点请求**
```json
POST /node-instances/:id/submit
{
  "outputData": {
    "report": "质量检查报告内容...",
    "score": 95
  },
  "comment": "已完成全部检测项"
}
```

---

## 九、任务（审批） `/tasks`

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/tasks` | 任务列表（支持 assigneeId、status 筛选） | 已登录 |
| GET | `/tasks/my` | 当前用户的待办任务 | 已登录 |
| GET | `/tasks/:id` | 任务详情 | 已登录 |
| POST | `/tasks/:id/approve` | 审批通过 | manager / admin |
| POST | `/tasks/:id/reject` | 审批拒绝（需附原因） | manager / admin |

---

## 十、知识库 `/knowledge-bases`

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/knowledge-bases` | 知识库列表 | 已登录 |
| POST | `/knowledge-bases` | 创建知识库 | manager / admin |
| GET | `/knowledge-bases/:id` | 知识库详情 | 已登录 |
| PUT | `/knowledge-bases/:id` | 更新知识库信息 | manager / admin |
| DELETE | `/knowledge-bases/:id` | 删除知识库 | admin |
| GET | `/knowledge-bases/:id/documents` | 文档列表 | 已登录 |
| POST | `/knowledge-bases/:id/documents` | 上传文档（multipart/form-data） | manager / admin |
| DELETE | `/knowledge-bases/:id/documents/:docId` | 删除文档 | manager / admin |

---

## 十一、模板市场 `/templates`

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/templates` | 模板列表 | 已登录 |
| GET | `/templates/:id` | 模板详情 | 已登录 |
| POST | `/templates` | 创建模板（from 流程定义） | designer / admin |
| POST | `/templates/:id/clone` | 克隆模板为新流程定义，返回新定义 ID | designer / admin |
| DELETE | `/templates/:id` | 删除模板 | admin |

---

## 十二、AI 设置 `/ai-settings`

### 提供商管理

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/ai-settings/providers` | 提供商列表（apiKey 脱敏，仅返回 `hasApiKey: boolean`） | admin |
| POST | `/ai-settings/providers` | 创建提供商 | admin |
| PUT | `/ai-settings/providers/:id` | 更新提供商 | admin |
| DELETE | `/ai-settings/providers/:id` | 删除提供商 | admin |
| POST | `/ai-settings/providers/:id/test` | 测试连接（返回 success/error + 模型列表） | admin |

### 模型管理

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/ai-settings/models` | 模型列表（可按 providerId / type 筛选） | admin |
| POST | `/ai-settings/models` | 添加模型 | admin |
| PUT | `/ai-settings/models/:id` | 更新模型 | admin |
| DELETE | `/ai-settings/models/:id` | 删除模型 | admin |
| PUT | `/ai-settings/models/:id/set-default` | 设为默认模型 | admin |

### Fallback 链

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/ai-settings/fallbacks` | Fallback 链列表（按 modelType 筛选） | admin |
| POST | `/ai-settings/fallbacks` | 添加 Fallback 条目 | admin |
| PUT | `/ai-settings/fallbacks/:id` | 更新条目（启用/禁用） | admin |
| DELETE | `/ai-settings/fallbacks/:id` | 删除条目 | admin |
| PUT | `/ai-settings/fallbacks/reorder` | 重排序（传入有序 id 数组） | admin |

### Agent 技能 / 角色

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET / POST | `/ai-settings/skills` | 技能列表 / 创建 | admin |
| PUT / DELETE | `/ai-settings/skills/:id` | 更新 / 删除技能 | admin |
| GET / POST | `/ai-settings/agent-roles` | 角色列表 / 创建 | admin |
| PUT / DELETE | `/ai-settings/agent-roles/:id` | 更新 / 删除角色 | admin |

---

## 十三、AI 报告 `/ai-reports`

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/ai-reports` | 报告列表 | 已登录 |
| GET | `/ai-reports/:id` | 报告详情 | 已登录 |
| GET | `/ai-reports/node/:nodeInstanceId` | 某节点实例的所有报告 | 已登录 |

---

## 十四、通知 `/notifications`

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/notifications` | 通知列表（当前用户） | 已登录 |
| PUT | `/notifications/:id/read` | 标记已读 | 已登录 |
| PUT | `/notifications/read-all` | 全部标记已读 | 已登录 |
| POST | `/notifications/scan-overdue` | 手动触发逾期扫描 | admin |

---

## 十五、审计日志 `/audit-log`

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/audit-log` | 审计日志列表（分页、筛选） | admin |

---

## 十六、健康检查 `/health`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 返回服务健康状态 |

---

## 十七、错误码说明

| HTTP 状态码 | 含义 |
|------------|------|
| 200 | 请求成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误（class-validator 校验失败） |
| 401 | 未登录或 Token 过期 |
| 403 | 权限不足（角色不符合要求） |
| 404 | 资源不存在 |
| 409 | 冲突（如唯一约束） |
| 500 | 服务器内部错误 |

所有错误统一格式：
```json
{
  "statusCode": 400,
  "message": "name must not be empty",
  "error": "Bad Request"
}
```
