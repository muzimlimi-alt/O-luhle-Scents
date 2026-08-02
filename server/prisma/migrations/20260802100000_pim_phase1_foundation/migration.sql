-- CreateEnum
CREATE TYPE "ProductFamily" AS ENUM ('PERFUME', 'CANDLE', 'HOME_FRAGRANCE', 'ACCESSORY', 'GIFT_SET');

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "cost_at_purchase" DECIMAL(10,2),
ADD COLUMN     "product_name_snapshot" TEXT,
ADD COLUMN     "sku_snapshot" TEXT,
ADD COLUMN     "variant_label_snapshot" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "brand_id" UUID,
ADD COLUMN     "care_instructions" TEXT,
ADD COLUMN     "family" "ProductFamily" NOT NULL DEFAULT 'PERFUME',
ADD COLUMN     "ingredients" TEXT,
ADD COLUMN     "internal_name" VARCHAR(150),
ADD COLUMN     "launch_date" TIMESTAMP(3),
ADD COLUMN     "marketing_description" TEXT,
ADD COLUMN     "meta_description" VARCHAR(180),
ADD COLUMN     "meta_title" VARCHAR(70),
ADD COLUMN     "retirement_date" TIMESTAMP(3),
ADD COLUMN     "safety_warnings" TEXT,
ADD COLUMN     "short_description" TEXT,
ADD COLUMN     "slug" VARCHAR(180),
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "usage_instructions" TEXT;

-- AlterTable
ALTER TABLE "quote_items" ADD COLUMN     "product_name_snapshot" TEXT,
ADD COLUMN     "sku_snapshot" TEXT,
ADD COLUMN     "variant_label_snapshot" TEXT;

-- CreateTable
CREATE TABLE "brands" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attribute_definitions" (
    "id" UUID NOT NULL,
    "key" VARCHAR(60) NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "family" "ProductFamily" NOT NULL,
    "dataType" VARCHAR(20) NOT NULL,
    "unit" VARCHAR(20),
    "options" JSONB,
    "applies_to_variant" BOOLEAN NOT NULL DEFAULT false,
    "is_filterable" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attribute_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_attribute_values" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "definition_id" UUID NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "product_attribute_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variant_attribute_values" (
    "id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "definition_id" UUID NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "variant_attribute_values_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "brands_name_key" ON "brands"("name");

-- CreateIndex
CREATE UNIQUE INDEX "brands_slug_key" ON "brands"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "attribute_definitions_key_key" ON "attribute_definitions"("key");

-- CreateIndex
CREATE INDEX "attribute_definitions_family_idx" ON "attribute_definitions"("family");

-- CreateIndex
CREATE INDEX "product_attribute_values_definition_id_value_idx" ON "product_attribute_values"("definition_id", "value");

-- CreateIndex
CREATE UNIQUE INDEX "product_attribute_values_product_id_definition_id_key" ON "product_attribute_values"("product_id", "definition_id");

-- CreateIndex
CREATE UNIQUE INDEX "variant_attribute_values_variant_id_definition_id_key" ON "variant_attribute_values"("variant_id", "definition_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_brand_id_idx" ON "products"("brand_id");

-- CreateIndex
CREATE INDEX "products_family_idx" ON "products"("family");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "attribute_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_attribute_values" ADD CONSTRAINT "variant_attribute_values_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_attribute_values" ADD CONSTRAINT "variant_attribute_values_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "attribute_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

