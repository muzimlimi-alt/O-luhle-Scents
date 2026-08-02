-- This migration backfills history for schema changes that were previously
-- applied directly against the dev database (e.g. via `prisma db push`)
-- without a corresponding migration file: the "subscribers" and
-- "newsletter_campaigns" tables, the aromatic/sensory columns on "products",
-- and the "uom"/"volume" columns on "product_variants". Because of that, the
-- migration history could not rebuild the schema from scratch (shadow-database
-- replay failed with P3006 / P1014). This migration is marked as
-- already-applied on the real database (`prisma migrate resolve --applied`)
-- and only actually executes when Prisma replays history on a fresh/shadow
-- database.

-- AlterTable
ALTER TABLE "products" ADD COLUMN "collection" VARCHAR(150),
ADD COLUMN     "type" VARCHAR(150),
ADD COLUMN     "oil_concentration" VARCHAR(150),
ADD COLUMN     "longevity" VARCHAR(150),
ADD COLUMN     "scent_family" VARCHAR(150),
ADD COLUMN     "characteristic" VARCHAR(150),
ADD COLUMN     "top_notes" TEXT,
ADD COLUMN     "heart_notes" TEXT,
ADD COLUMN     "base_notes" TEXT,
ADD COLUMN     "card_badge" VARCHAR(50);

-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN "uom" VARCHAR(20) NOT NULL DEFAULT 'ml',
ADD COLUMN     "volume" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "subscribers" (
    "id" UUID NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "source" VARCHAR(50) NOT NULL DEFAULT 'frontend',
    "unsubscribe_token" VARCHAR(128),
    "token_expires_at" TIMESTAMP(3),
    "added_by" VARCHAR(150),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscribers_email_key" ON "subscribers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "subscribers_unsubscribe_token_key" ON "subscribers"("unsubscribe_token");

-- Note: the "status" index on subscribers is created later by migration
-- 20260801004154_add_indexes_and_payment_unique_constraint — not duplicated here.

-- CreateTable
CREATE TABLE "newsletter_campaigns" (
    "id" UUID NOT NULL,
    "subject" VARCHAR(200) NOT NULL,
    "content_html" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "sent_at" TIMESTAMP(3),
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "attachments" JSONB,
    "admin_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "newsletter_campaigns_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "newsletter_campaigns" ADD CONSTRAINT "newsletter_campaigns_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
