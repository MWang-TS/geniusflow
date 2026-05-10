-- CreateTable
CREATE TABLE "wiki_triples" (
    "id" TEXT NOT NULL,
    "knowledge_base_id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "predicate" TEXT NOT NULL,
    "object" TEXT NOT NULL,
    "source_slug" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wiki_triples_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wiki_triples_knowledge_base_id_idx" ON "wiki_triples"("knowledge_base_id");

-- AddForeignKey
ALTER TABLE "wiki_triples" ADD CONSTRAINT "wiki_triples_knowledge_base_id_fkey" FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
