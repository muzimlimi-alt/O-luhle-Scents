-- Multi-category product architecture + catalogue import staging.
--
-- Additive-only: no existing columns renamed or dropped. Product.collection
-- (free-text string) is retained; the backfill script transfers its values
-- into the new Collection / ProductCollection tables.
--
-- The BATH_SALT enum addition lives in the preceding migration
-- (20261114115959_add_bath_salt_family) because ALTER TYPE ... ADD VALUE
-- cannot run in the same transaction as other statements.

-- 1. Collection entity + many-to-many

CREATE TABLE "collections" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(140) NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "collections_name_key" ON "collections"("name");
CREATE UNIQUE INDEX "collections_slug_key" ON "collections"("slug");

CREATE TABLE "product_collections" (
    "product_id" UUID NOT NULL,
    "collection_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_collections_pkey" PRIMARY KEY ("product_id","collection_id")
);

CREATE INDEX "product_collections_collection_id_idx" ON "product_collections"("collection_id");

ALTER TABLE "product_collections"
    ADD CONSTRAINT "product_collections_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_collections"
    ADD CONSTRAINT "product_collections_collection_id_fkey"
    FOREIGN KEY ("collection_id") REFERENCES "collections"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Catalogue import staging enums

CREATE TYPE "CatalogueImportStatus" AS ENUM (
    'UPLOADED',
    'PROCESSING',
    'EXTRACTED',
    'AWAITING_REVIEW',
    'APPROVED',
    'IMPORTED',
    'REJECTED',
    'FAILED'
);

CREATE TYPE "ExtractedProductStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'IMPORTED'
);

-- 3. catalogue_sources

CREATE TABLE "catalogue_sources" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "source_type" VARCHAR(20) NOT NULL DEFAULT 'pdf',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalogue_sources_pkey" PRIMARY KEY ("id")
);

-- 4. catalogue_imports

CREATE TABLE "catalogue_imports" (
    "id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "original_filename" VARCHAR(255) NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "status" "CatalogueImportStatus" NOT NULL DEFAULT 'UPLOADED',
    "error_message" TEXT,
    "uploaded_by_admin_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "processed_at" TIMESTAMP(3),
    "imported_at" TIMESTAMP(3),

    CONSTRAINT "catalogue_imports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "catalogue_imports_status_idx" ON "catalogue_imports"("status");
CREATE INDEX "catalogue_imports_source_id_idx" ON "catalogue_imports"("source_id");

ALTER TABLE "catalogue_imports"
    ADD CONSTRAINT "catalogue_imports_source_id_fkey"
    FOREIGN KEY ("source_id") REFERENCES "catalogue_sources"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. extracted_products

CREATE TABLE "extracted_products" (
    "id" UUID NOT NULL,
    "import_id" UUID NOT NULL,
    "page_reference" VARCHAR(50),
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "family" "ProductFamily",
    "suggested_category_id" UUID,
    "suggested_collection_id" UUID,
    "price_hint" DECIMAL(10,2),
    "variants_json" JSONB,
    "attributes_json" JSONB,
    "images_json" JSONB,
    "dedupe_hash" VARCHAR(64),
    "status" "ExtractedProductStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by_admin_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "reject_reason" TEXT,
    "imported_product_id" UUID,
    "imported_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extracted_products_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "extracted_products_import_id_status_idx" ON "extracted_products"("import_id","status");
CREATE INDEX "extracted_products_status_idx" ON "extracted_products"("status");
CREATE INDEX "extracted_products_dedupe_hash_idx" ON "extracted_products"("dedupe_hash");

ALTER TABLE "extracted_products"
    ADD CONSTRAINT "extracted_products_import_id_fkey"
    FOREIGN KEY ("import_id") REFERENCES "catalogue_imports"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
