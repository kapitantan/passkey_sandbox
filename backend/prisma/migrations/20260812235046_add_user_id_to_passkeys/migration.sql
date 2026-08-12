/*
  Warnings:

  - Added the required column `user_id` to the `passkeys` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "challenges" ADD COLUMN     "user_id" TEXT;

-- AlterTable
ALTER TABLE "passkeys" ADD COLUMN     "user_id" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "passkeys_user_id_idx" ON "passkeys"("user_id");
