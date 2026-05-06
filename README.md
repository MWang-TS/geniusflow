# GeniusFlow

> AI 驱动的企业流程管理平台 — 将线下业务流程数字化，每个节点内置 AI Agent，实现人机协同执行与管控。

---

## 目录

- [产品简介](#产品简介)
- [核心功能](#核心功能)
- [技术架构](#技术架构)
- [快速开始](#快速开始)
  - [环境要求](#环境要求)
  - [本地开发](#本地开发)
  - [Docker 部署](#docker-部署)
- [目录结构](#目录结构)
- [环境变量](#环境变量)
- [默认账号](#默认账号)

---

## 产品简介

GeniusFlow 是一个面向企业的 **AI 增强流程管理平台**。业务人员通过可视化拖拽设计流程，每个节点内置专属 AI Agent（Co-pilot / 顾问 / 督导 / 助理），在执行阶段为员工提供实时指引、知识推荐与自动质量检查，同时为管理者提供进度监控和辅助审批能力。

**核心价值：**
- 员工：获得实时 AI 辅助，提升执行效率与规范性
- 管理者：自动化进度监控、风险预警、辅助审批
- 企业：沉淀流程模板与知识资产，实现可复用最佳实践

---

## 核心功能

| 模块 | 描述 |
|------|------|
| 🎨 **流程设计器** | 拖拽式可视化流程设计，节点库 + 属性配置面板 |
| ⚙️ **节点配置引擎** | 输入 → 行动 → 输出三段式配置，每段可挂载 AI Agent |
| 📋 **员工工作台** | 我的任务列表，按步骤执行节点，AI 实时辅助 |
| ✅ **审批中心** | 管理节点的审批工作流，AI 自动生成审批摘要 |
| 📊 **进度监控** | 甘特图展示流程进度，自动预警延期风险 |
| 📚 **知识库** | 文档上传与向量化，节点执行时 RAG 精准召回 |
| 🤖 **AI 配置** | 多模型提供商管理、Agent 角色配置、降级链设置、全量导入导出 |
| 🏪 **模板市场** | 行业预设流程模板，按职能线筛选，一键复制使用 |
| 💬 **AI 助理模式** | 企业知识库对话助理，支持 Function Calling（工具调用） |
| 🔑 **AI 中台模式** | 提供 OpenAPI 密钥管理，供内部平台集成调用 |
| 👥 **用户权限** | RBAC 角色管理，支持按角色配置可见页面 |

---

## 技术架构

```
┌─────────────────────────────────────────────────────┐
│              前端 React 18 + Ant Design 5            │
│          流程设计器 (React Flow) / 工作台 / 管理后台   │
└────────────────────────┬────────────────────────────┘
                         │ Nginx 反向代理
          ┌──────────────┴──────────────┐
          ▼                             ▼
┌──────────────────┐          ┌──────────────────┐
│  主服务 NestJS   │◀────────▶│  AI 服务 FastAPI  │
│  REST API + WS   │  HTTP    │  LangChain + RAG  │
│  Bull 任务队列   │          │  多模型路由       │
└────────┬─────────┘          └──────────────────┘
         │
┌────────┴──────────────────────────────┐
│            数据层                      │
│  PostgreSQL + pgvector  │  Redis       │
└────────────────────────────────────────┘
```

**技术栈：**

| 层级 | 技术 |
|------|------|
| 前端 | React 18、Vite 5、Ant Design 5、React Flow、Zustand |
| 主服务 | NestJS 10、Prisma ORM、PostgreSQL、Redis、Bull |
| AI 服务 | Python 3.11、FastAPI、LangChain、pgvector |
| 基础设施 | Docker Compose、Nginx |

---

## 快速开始

### 环境要求

- Node.js 20+
- Python 3.11+
- Docker & Docker Compose（生产部署）
- PostgreSQL 16（含 pgvector 扩展）
- Redis 7+

### 本地开发

**1. 克隆仓库**

```bash
git clone <repo-url>
cd geniusflow
```

**2. 配置环境变量**

```bash
# 主服务
cp api/.env.example api/.env
# 编辑 api/.env，填写数据库、Redis、JWT 密钥等

# AI 服务
cp ai-service/.env.example ai-service/.env
# 编辑 ai-service/.env，填写 OPENAI_API_KEY 等
```

**3. 启动主服务（API）**

```bash
cd api
npm install
npx prisma migrate dev   # 初始化数据库
npx prisma db seed       # 写入种子数据（含默认账号）
npm run start:dev
```

**4. 启动前端**

```bash
cd web
npm install
npm run dev
```

**5. 启动 AI 服务**

```bash
cd ai-service
pip install -r requirements.txt
uvicorn main:app --reload --port 5000
```

> 前端默认访问 http://localhost:3000，API 端口 4001，AI 服务端口 5000。

### Docker 部署

**1. 配置环境变量**

```bash
# 在项目根目录创建 .env 文件
cat > .env << EOF
JWT_SECRET=your-strong-jwt-secret
OPENAI_API_KEY=sk-xxxxxxxxxxxx
EOF
```

**2. 构建并启动**

```bash
docker-compose up -d --build
```

**3. 初始化数据库**

```bash
docker-compose exec api npx prisma migrate deploy
docker-compose exec api npx prisma db seed
```

访问 http://localhost:8080（Nginx 默认映射 8080 端口）

---

## 目录结构

```
geniusflow/
├── api/                    # 主服务 (NestJS)
│   ├── src/
│   │   ├── auth/           # JWT 认证 & 授权
│   │   ├── roles/          # 角色 & 路由权限管理
│   │   ├── users/          # 用户管理
│   │   ├── process-definitions/  # 流程定义
│   │   ├── process-instances/    # 流程实例（运行时）
│   │   ├── node-definitions/     # 节点定义
│   │   ├── node-instances/       # 节点实例（执行）
│   │   ├── tasks/          # 任务管理
│   │   ├── approvals/      # 审批流转
│   │   ├── knowledge-bases/# 知识库
│   │   ├── ai-assistant/   # AI 对话接口
│   │   ├── ai-settings/    # AI 模型配置
│   │   ├── notifications/  # 通知
│   │   ├── scheduler/      # 定时任务（进度预警）
│   │   └── queue/          # 异步队列（AI 处理）
│   └── prisma/             # 数据库 Schema & 迁移
│
├── web/                    # 前端 (React + Vite)
│   └── src/
│       ├── pages/          # 页面组件
│       ├── components/     # 公共组件（布局、流程编辑器、AI 助手等）
│       ├── stores/         # 全局状态 (Zustand)
│       ├── api/            # API 客户端
│       └── config/         # 路由配置等
│
├── ai-service/             # AI 服务 (FastAPI)
│   └── app/
│       ├── api/            # 接口路由
│       └── services/       # 文档解析、向量检索
│
├── docker-compose.yml      # 容器编排
└── nginx.conf              # Nginx 配置
```

---

## 环境变量

### api/.env

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/geniusflow
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=2h
REFRESH_TOKEN_EXPIRES_IN=7d
AI_SERVICE_URL=http://localhost:5000
PORT=4001
```

### ai-service/.env

```env
OPENAI_API_KEY=sk-xxxxxxxxxxxx
OPENAI_MODEL=gpt-4o-mini
EMBEDDING_MODEL=text-embedding-3-small
DATABASE_URL=postgresql://postgres:password@localhost:5432/geniusflow
REDIS_URL=redis://localhost:6379
```

---

## 默认账号

执行 `prisma db seed` 后会创建以下默认账号：

| 邮箱 | 密码 | 角色 |
|------|------|------|
| admin@geniusflow.com | admin123 | 系统管理员 |

> ⚠️ 生产环境请登录后立即修改默认密码。

---

## 权限说明

系统采用 RBAC 权限模型，支持在 **系统管理 → 角色管理** 中为每个角色配置可见页面：

- `admin` 角色默认可访问所有页面
- 其他角色的可见菜单 = 所属所有角色路由权限的并集
- 菜单过滤和路由守卫双重保障，无权限访问返回 403

---

## 平台模式

系统支持三种使用模式，在**登录页**切换，登录后自动跳转对应首页：

| 模式 | 说明 | 首页路径 |
|------|------|----------|
| 🔄 **流程任务模式** | 设计并执行业务流程，AI 辅助质检与审批 | `/processes` |
| 💬 **AI 助理模式** | 企业知识库对话助理，支持 Function Calling | `/skill-assistant` |
| 🔑 **AI 中台模式** | 提供标准 API 接口，供内部平台集成使用 | `/api-platform` |

---

## License

MIT
