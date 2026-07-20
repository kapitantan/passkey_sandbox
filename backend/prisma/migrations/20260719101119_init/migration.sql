-- CreateTable
CREATE TABLE "challenges" (
    "challenge" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "username" TEXT NOT NULL,

    CONSTRAINT "challenges_pkey" PRIMARY KEY ("challenge")
);

-- CreateTable
CREATE TABLE "passkeys" (
    "credential_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "public_key" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "passkeys_pkey" PRIMARY KEY ("credential_id")
);

-- CreateIndex
CREATE INDEX "challenges_username_idx" ON "challenges"("username");

-- CreateIndex
CREATE INDEX "challenges_expires_at_idx" ON "challenges"("expires_at");

-- CreateIndex
CREATE INDEX "passkeys_username_idx" ON "passkeys"("username");
