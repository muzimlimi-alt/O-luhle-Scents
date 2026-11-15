-- Merchandising: featured products for The TOCA Favourites, and curated
-- cross-category product pairings (Complete the Scent Experience).

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "featured_order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "is_featured" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "product_pairings" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "paired_product_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_pairings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_pairings_paired_product_id_idx" ON "product_pairings"("paired_product_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_pairings_product_id_paired_product_id_key" ON "product_pairings"("product_id", "paired_product_id");

-- CreateIndex
CREATE INDEX "products_is_featured_featured_order_idx" ON "products"("is_featured", "featured_order");

-- AddForeignKey
ALTER TABLE "product_pairings" ADD CONSTRAINT "product_pairings_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_pairings" ADD CONSTRAINT "product_pairings_paired_product_id_fkey" FOREIGN KEY ("paired_product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

