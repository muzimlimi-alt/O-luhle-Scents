-- CreateTable
CREATE TABLE "product_reviews" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "order_item_id" UUID,
    "rating" INTEGER NOT NULL,
    "title" VARCHAR(200),
    "body" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "moderated_by" UUID,
    "moderated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_reviews_order_item_id_key" ON "product_reviews"("order_item_id");

-- CreateIndex
CREATE INDEX "product_reviews_product_id_status_idx" ON "product_reviews"("product_id", "status");

-- CreateIndex
CREATE INDEX "product_reviews_customer_id_idx" ON "product_reviews"("customer_id");

-- CreateIndex
CREATE INDEX "product_reviews_status_created_at_idx" ON "product_reviews"("status", "created_at");

-- AddForeignKey
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
