-- CreateTable
CREATE TABLE "model_fallback_chains" (
    "id" TEXT NOT NULL,
    "model_type" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "model_id" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "model_fallback_chains_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "model_fallback_chains_model_type_sort_order_key" ON "model_fallback_chains"("model_type", "sort_order");

-- AddForeignKey
ALTER TABLE "model_fallback_chains" ADD CONSTRAINT "model_fallback_chains_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "ai_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;
