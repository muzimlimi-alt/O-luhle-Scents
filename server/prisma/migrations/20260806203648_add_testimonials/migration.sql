-- CreateTable
CREATE TABLE "testimonials" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "designation" VARCHAR(120),
    "quote" TEXT NOT NULL,
    "image_path" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "submitted_by" VARCHAR(20) NOT NULL DEFAULT 'visitor',
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "testimonials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "testimonials_status_idx" ON "testimonials"("status");

