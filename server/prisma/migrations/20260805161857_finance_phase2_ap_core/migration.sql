-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "JournalSourceType" ADD VALUE 'PURCHASE_RECEIVE';
ALTER TYPE "JournalSourceType" ADD VALUE 'SUPPLIER_PAYMENT';

-- AlterTable
ALTER TABLE "purchases" ADD COLUMN     "payment_status" VARCHAR(30) NOT NULL DEFAULT 'unpaid';

-- CreateTable
CREATE TABLE "supplier_payments" (
    "id" UUID NOT NULL,
    "purchase_id" UUID NOT NULL,
    "method" VARCHAR(30) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reference" VARCHAR(150),
    "notes" TEXT,
    "admin_user_id" UUID,
    "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supplier_payments_purchase_id_idx" ON "supplier_payments"("purchase_id");

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
