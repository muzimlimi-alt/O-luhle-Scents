-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "billing_address_id" UUID,
ADD COLUMN     "coupon_id" UUID,
ADD COLUMN     "discount_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "internal_notes" TEXT,
ADD COLUMN     "tax_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "tax_rate_id" UUID;

-- CreateTable
CREATE TABLE "tax_rates" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "rate" DECIMAL(5,4) NOT NULL,
    "region" VARCHAR(100),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipping_methods" (
    "id" UUID NOT NULL,
    "key" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "tracking_url_template" TEXT,
    "estimated_days" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipping_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "return_item_id" UUID,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" VARCHAR(30) NOT NULL,
    "reference" VARCHAR(150),
    "notes" TEXT,
    "admin_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_requests" (
    "id" UUID NOT NULL,
    "return_item_id" UUID NOT NULL,
    "replacement_variant_id" UUID NOT NULL,
    "new_order_item_id" UUID,
    "price_difference" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_milestones" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "amount_due" DECIMAL(10,2) NOT NULL,
    "due_date" TIMESTAMP(3),
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "paid_at" TIMESTAMP(3),
    "payment_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shipping_methods_key_key" ON "shipping_methods"("key");

-- CreateIndex
CREATE INDEX "refunds_order_id_idx" ON "refunds"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_requests_new_order_item_id_key" ON "exchange_requests"("new_order_item_id");

-- CreateIndex
CREATE INDEX "exchange_requests_return_item_id_idx" ON "exchange_requests"("return_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_milestones_payment_id_key" ON "payment_milestones"("payment_id");

-- CreateIndex
CREATE INDEX "payment_milestones_order_id_idx" ON "payment_milestones"("order_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_billing_address_id_fkey" FOREIGN KEY ("billing_address_id") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_tax_rate_id_fkey" FOREIGN KEY ("tax_rate_id") REFERENCES "tax_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_return_item_id_fkey" FOREIGN KEY ("return_item_id") REFERENCES "return_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_requests" ADD CONSTRAINT "exchange_requests_return_item_id_fkey" FOREIGN KEY ("return_item_id") REFERENCES "return_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_requests" ADD CONSTRAINT "exchange_requests_replacement_variant_id_fkey" FOREIGN KEY ("replacement_variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_requests" ADD CONSTRAINT "exchange_requests_new_order_item_id_fkey" FOREIGN KEY ("new_order_item_id") REFERENCES "order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_milestones" ADD CONSTRAINT "payment_milestones_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_milestones" ADD CONSTRAINT "payment_milestones_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

