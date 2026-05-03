-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "scope_type" TEXT NOT NULL DEFAULT 'global',
    "scope_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "process_definitions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "graph_json" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "description" TEXT,
    "category" TEXT,
    "is_template" BOOLEAN NOT NULL DEFAULT false,
    "is_preset" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "process_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "node_definitions" (
    "id" TEXT NOT NULL,
    "process_id" TEXT NOT NULL,
    "node_name" TEXT NOT NULL,
    "node_type" TEXT NOT NULL DEFAULT 'task',
    "input_spec" JSONB NOT NULL,
    "action_spec" JSONB NOT NULL,
    "output_spec" JSONB NOT NULL,
    "ai_config" JSONB NOT NULL,
    "progress_config" JSONB NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "node_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "process_instances" (
    "id" TEXT NOT NULL,
    "definition_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "planned_start_date" TIMESTAMP(3),
    "actual_start_date" TIMESTAMP(3),
    "current_node_id" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "process_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "node_instances" (
    "id" TEXT NOT NULL,
    "instance_id" TEXT NOT NULL,
    "definition_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "planned_start_date" TIMESTAMP(3),
    "planned_end_date" TIMESTAMP(3),
    "actual_start_date" TIMESTAMP(3),
    "actual_end_date" TIMESTAMP(3),
    "percent_complete" INTEGER NOT NULL DEFAULT 0,
    "input_data" JSONB,
    "output_data" JSONB,
    "assignee_user_id" TEXT,
    "responsible_role_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "node_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "node_instance_history" (
    "id" TEXT NOT NULL,
    "node_instance_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "from_status" TEXT,
    "to_status" TEXT,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "node_instance_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "node_instance_id" TEXT NOT NULL,
    "assignee_user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "due_date" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_bases" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_bases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_base_documents" (
    "id" TEXT NOT NULL,
    "knowledge_base_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "file_size" BIGINT NOT NULL DEFAULT 0,
    "mime_type" TEXT,
    "parse_status" TEXT NOT NULL DEFAULT 'pending',
    "vectorized_status" TEXT NOT NULL DEFAULT 'pending',
    "chunk_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_base_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_chunks" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_agent_logs" (
    "id" TEXT NOT NULL,
    "node_instance_id" TEXT,
    "role" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB,
    "latency_ms" INTEGER,
    "is_fallback" BOOLEAN NOT NULL DEFAULT false,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_agent_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_reports" (
    "id" TEXT NOT NULL,
    "node_instance_id" TEXT NOT NULL,
    "report_type" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT,
    "details" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'in_app',
    "status" TEXT NOT NULL DEFAULT 'unread',
    "related_resource_type" TEXT,
    "related_resource_id" TEXT,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_providers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "base_url" TEXT,
    "api_key" TEXT,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "extra" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_models" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "context_window" INTEGER,
    "max_tokens" INTEGER,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "extra" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_skills" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "system_prompt" TEXT,
    "model_id" TEXT,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "max_tokens" INTEGER,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_role_skills" (
    "id" TEXT NOT NULL,
    "agent_role_id" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_role_skills_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_id_scope_type_scope_id_key" ON "user_roles"("user_id", "role_id", "scope_type", "scope_id");

-- CreateIndex
CREATE UNIQUE INDEX "process_definitions_name_version_key" ON "process_definitions"("name", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ai_providers_name_key" ON "ai_providers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ai_models_provider_id_model_id_type_key" ON "ai_models"("provider_id", "model_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "agent_skills_name_key" ON "agent_skills"("name");

-- CreateIndex
CREATE UNIQUE INDEX "agent_roles_name_key" ON "agent_roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "agent_role_skills_agent_role_id_skill_id_key" ON "agent_role_skills"("agent_role_id", "skill_id");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_definitions" ADD CONSTRAINT "process_definitions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node_definitions" ADD CONSTRAINT "node_definitions_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "process_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_instances" ADD CONSTRAINT "process_instances_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "process_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_instances" ADD CONSTRAINT "process_instances_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node_instances" ADD CONSTRAINT "node_instances_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "process_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node_instances" ADD CONSTRAINT "node_instances_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "node_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node_instances" ADD CONSTRAINT "node_instances_assignee_user_id_fkey" FOREIGN KEY ("assignee_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node_instances" ADD CONSTRAINT "node_instances_responsible_role_id_fkey" FOREIGN KEY ("responsible_role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node_instance_history" ADD CONSTRAINT "node_instance_history_node_instance_id_fkey" FOREIGN KEY ("node_instance_id") REFERENCES "node_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_node_instance_id_fkey" FOREIGN KEY ("node_instance_id") REFERENCES "node_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_user_id_fkey" FOREIGN KEY ("assignee_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_base_documents" ADD CONSTRAINT "knowledge_base_documents_knowledge_base_id_fkey" FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "knowledge_base_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_agent_logs" ADD CONSTRAINT "ai_agent_logs_node_instance_id_fkey" FOREIGN KEY ("node_instance_id") REFERENCES "node_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_reports" ADD CONSTRAINT "ai_reports_node_instance_id_fkey" FOREIGN KEY ("node_instance_id") REFERENCES "node_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_models" ADD CONSTRAINT "ai_models_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "ai_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_roles" ADD CONSTRAINT "agent_roles_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "ai_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_role_skills" ADD CONSTRAINT "agent_role_skills_agent_role_id_fkey" FOREIGN KEY ("agent_role_id") REFERENCES "agent_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_role_skills" ADD CONSTRAINT "agent_role_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "agent_skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;
