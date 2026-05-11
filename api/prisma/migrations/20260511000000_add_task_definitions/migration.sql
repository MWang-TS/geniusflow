-- Add sopCode to process_definitions
ALTER TABLE "process_definitions" ADD COLUMN "sop_code" TEXT;
CREATE UNIQUE INDEX "process_definitions_sop_code_key" ON "process_definitions"("sop_code");

-- Add new columns to tasks
ALTER TABLE "tasks" ADD COLUMN "title" TEXT;
ALTER TABLE "tasks" ADD COLUMN "task_code" TEXT;
ALTER TABLE "tasks" ADD COLUMN "task_def_id" TEXT;

-- Create task_definitions table
CREATE TABLE "task_definitions" (
    "id" TEXT NOT NULL,
    "process_def_id" TEXT NOT NULL,
    "node_def_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "task_type" TEXT NOT NULL DEFAULT 'checklist',
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_definitions_pkey" PRIMARY KEY ("id")
);

-- Add foreign keys
ALTER TABLE "task_definitions" ADD CONSTRAINT "task_definitions_process_def_id_fkey"
    FOREIGN KEY ("process_def_id") REFERENCES "process_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "task_definitions" ADD CONSTRAINT "task_definitions_node_def_id_fkey"
    FOREIGN KEY ("node_def_id") REFERENCES "node_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_task_def_id_fkey"
    FOREIGN KEY ("task_def_id") REFERENCES "task_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
