-- Add mode column to knowledge_bases
ALTER TABLE "knowledge_bases" ADD COLUMN "mode" VARCHAR(20) NOT NULL DEFAULT 'rag';

-- Add settings JSONB column
ALTER TABLE "knowledge_bases" ADD COLUMN "settings" JSONB;

-- Migrate existing wiki-type rows: set mode=wiki, reclassify type to 'general'
UPDATE "knowledge_bases" SET "mode" = 'wiki', "type" = 'general' WHERE "type" = 'wiki';

-- Rename legacy RAG types to a neutral category name
UPDATE "knowledge_bases" SET "type" = '规范' WHERE "type" = 'standard';
UPDATE "knowledge_bases" SET "type" = '说明书' WHERE "type" = 'expertise';
