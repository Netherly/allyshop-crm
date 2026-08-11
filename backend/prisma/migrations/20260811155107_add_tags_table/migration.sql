-- CreateTable
CREATE TABLE "tags" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- Бэкфилл: переносим уже использованные в заказах теги в справочник (чтобы автоподсказка не потеряла их)
INSERT INTO "tags" ("name", "created_at", "updated_at")
SELECT DISTINCT trim(t) AS name, now(), now()
FROM "orders", unnest(string_to_array("orders"."tags", ',')) AS t
WHERE "orders"."tags" IS NOT NULL AND trim(t) <> ''
ON CONFLICT ("name") DO NOTHING;
