-- Customer auth fields (guest checkouts still create passwordless rows)
ALTER TABLE "customers" ADD COLUMN     "password_hash" TEXT,
ADD COLUMN     "password_reset_expires_at" TIMESTAMP(3),
ADD COLUMN     "password_reset_token" TEXT;

-- Sequential order numbers: add nullable first, backfill, then enforce NOT NULL.
CREATE SEQUENCE IF NOT EXISTS "order_number_seq" START WITH 100001;

ALTER TABLE "orders" ADD COLUMN     "order_number" VARCHAR(30);

UPDATE "orders" o
SET "order_number" = 'OSC-' || sub.num
FROM (
  SELECT id, nextval('order_number_seq') AS num
  FROM "orders"
  ORDER BY "created_at" ASC
) sub
WHERE o.id = sub.id;

ALTER TABLE "orders" ALTER COLUMN "order_number" SET NOT NULL;

-- Manual EFT verification fields on Payment
ALTER TABLE "payments" ADD COLUMN     "eft_verification_status" VARCHAR(20),
ADD COLUMN     "proof_file_name" VARCHAR(255),
ADD COLUMN     "proof_file_size" INTEGER,
ADD COLUMN     "proof_mime_type" VARCHAR(100),
ADD COLUMN     "proof_of_payment_url" TEXT,
ADD COLUMN     "proof_uploaded_at" TIMESTAMP(3),
ADD COLUMN     "rejection_reason" TEXT,
ADD COLUMN     "verified_at" TIMESTAMP(3),
ADD COLUMN     "verified_by_admin_id" UUID;

-- Payment status history timeline
CREATE TABLE "payment_status_history" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "note" TEXT,
    "actor_type" VARCHAR(20) NOT NULL,
    "actor_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_status_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payment_status_history_payment_id_idx" ON "payment_status_history"("payment_id");

CREATE UNIQUE INDEX "customers_password_reset_token_key" ON "customers"("password_reset_token");

CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");

CREATE INDEX "payments_eft_verification_status_idx" ON "payments"("eft_verification_status");

ALTER TABLE "payments" ADD CONSTRAINT "payments_verified_by_admin_id_fkey" FOREIGN KEY ("verified_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payment_status_history" ADD CONSTRAINT "payment_status_history_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
