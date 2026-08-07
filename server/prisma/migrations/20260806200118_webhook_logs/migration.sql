-- CreateTable
CREATE TABLE "webhook_logs" (
    "id" UUID NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "outcome" VARCHAR(50) NOT NULL,
    "source_ip" VARCHAR(64),
    "order_id" UUID,
    "payload" JSONB,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "webhook_logs_provider_created_at_idx" ON "webhook_logs"("provider", "created_at");

-- CreateIndex
CREATE INDEX "webhook_logs_order_id_idx" ON "webhook_logs"("order_id");

-- CreateIndex
CREATE INDEX "webhook_logs_outcome_created_at_idx" ON "webhook_logs"("outcome", "created_at");

