-- AlterEnum
ALTER TYPE "JournalSourceType" ADD VALUE 'EXPENSE';

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "labelling_cost_at_purchase" DECIMAL(10,2),
ADD COLUMN     "packaging_cost_at_purchase" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN     "labelling_cost" DECIMAL(10,2),
ADD COLUMN     "packaging_cost" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL,
    "account_code" VARCHAR(20) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "description" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payment_method" VARCHAR(30),
    "admin_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "expenses_account_code_date_idx" ON "expenses"("account_code", "date");

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
