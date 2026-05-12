-- AlterTable
ALTER TABLE "knowledge_bases" ALTER COLUMN "mode" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "wiki_pages" ALTER COLUMN "tags" DROP DEFAULT;
