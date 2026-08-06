-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "last_reminder_sent_at" TIMESTAMP(3),
ADD COLUMN     "reminder_count" INTEGER NOT NULL DEFAULT 0;

