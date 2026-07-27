-- AlterTable
ALTER TABLE "order_delivery" ADD COLUMN     "actual_delivery_date" TEXT,
ADD COLUMN     "cargo_description" TEXT,
ADD COLUMN     "payer_type" TEXT,
ADD COLUMN     "scheduled_delivery_date" TEXT,
ADD COLUMN     "sender_city" TEXT,
ADD COLUMN     "sender_name" TEXT,
ADD COLUMN     "status_code" TEXT,
ADD COLUMN     "weight" TEXT;
