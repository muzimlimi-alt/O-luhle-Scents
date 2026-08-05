-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "bank_name" VARCHAR(150),
    "account_holder" VARCHAR(150),
    "account_number" VARCHAR(100),
    "branch_code" VARCHAR(50),
    "account_type" VARCHAR(50),
    "swift" VARCHAR(50),
    "chart_account_code" VARCHAR(20) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_transactions" (
    "id" UUID NOT NULL,
    "bank_account_id" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reference" VARCHAR(150),
    "status" VARCHAR(20) NOT NULL DEFAULT 'UNMATCHED',
    "matched_journal_line_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bank_transactions_matched_journal_line_id_key" ON "bank_transactions"("matched_journal_line_id");

-- CreateIndex
CREATE INDEX "bank_transactions_bank_account_id_status_idx" ON "bank_transactions"("bank_account_id", "status");

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_matched_journal_line_id_fkey" FOREIGN KEY ("matched_journal_line_id") REFERENCES "journal_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
