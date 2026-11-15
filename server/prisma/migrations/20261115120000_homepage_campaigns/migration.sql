-- CreateTable
CREATE TABLE "homepage_campaigns" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "eyebrow" VARCHAR(60),
    "heading" VARCHAR(200) NOT NULL,
    "subheading" VARCHAR(300),
    "cta_label" VARCHAR(60),
    "cta_href" VARCHAR(300),
    "desktop_image" VARCHAR(300),
    "mobile_image" VARCHAR(300),
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "homepage_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "homepage_campaigns_is_active_starts_at_ends_at_idx" ON "homepage_campaigns"("is_active", "starts_at", "ends_at");
