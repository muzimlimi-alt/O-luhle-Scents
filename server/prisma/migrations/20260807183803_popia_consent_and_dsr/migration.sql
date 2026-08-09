-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "anonymized_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "consent_records" (
    "id" UUID NOT NULL,
    "customer_id" UUID,
    "subject_email" VARCHAR(150),
    "purpose" VARCHAR(40) NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "method" VARCHAR(40) NOT NULL,
    "policy_version" INTEGER NOT NULL DEFAULT 1,
    "ip_address" VARCHAR(64),
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_subject_requests" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'submitted',
    "details" TEXT,
    "resolution_notes" TEXT,
    "export_file_url" TEXT,
    "resolved_by_admin_id" UUID,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "data_subject_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_retention_policies" (
    "id" UUID NOT NULL,
    "category" VARCHAR(60) NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "retention_days" INTEGER NOT NULL,
    "auto_delete" BOOLEAN NOT NULL DEFAULT false,
    "updated_by_admin_id" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_retention_policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consent_records_customer_id_purpose_created_at_idx" ON "consent_records"("customer_id", "purpose", "created_at");

-- CreateIndex
CREATE INDEX "consent_records_subject_email_purpose_created_at_idx" ON "consent_records"("subject_email", "purpose", "created_at");

-- CreateIndex
CREATE INDEX "data_subject_requests_status_requested_at_idx" ON "data_subject_requests"("status", "requested_at");

-- CreateIndex
CREATE INDEX "data_subject_requests_customer_id_idx" ON "data_subject_requests"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "data_retention_policies_category_key" ON "data_retention_policies"("category");

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_subject_requests" ADD CONSTRAINT "data_subject_requests_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_subject_requests" ADD CONSTRAINT "data_subject_requests_resolved_by_admin_id_fkey" FOREIGN KEY ("resolved_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_retention_policies" ADD CONSTRAINT "data_retention_policies_updated_by_admin_id_fkey" FOREIGN KEY ("updated_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

