-- AlterTable: add description to GamePlan
ALTER TABLE "GamePlan" ADD COLUMN IF NOT EXISTS "description" TEXT;

-- CreateTable: game_versions (GameVersion model with @@map("game_versions"))
CREATE TABLE IF NOT EXISTS "game_versions" (
    "id" SERIAL NOT NULL,
    "game_id" INTEGER NOT NULL,
    "hosted_at" VARCHAR(500) NOT NULL,
    "plan_snapshot" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_versions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "game_versions" ADD CONSTRAINT "game_versions_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Optional: backfill one GameVersion per existing live Game (run if you have existing games)
-- INSERT INTO "game_versions" ("game_id", "hosted_at", "plan_snapshot", "is_default", "archived", "created_at", "updated_at")
-- SELECT g."id", g."hosted_at", COALESCE(p."plan_text", '{}'), true, false, NOW(), NOW()
-- FROM "Game" g
-- LEFT JOIN "GamePlan" p ON p."game_id" = g."id"
-- WHERE g."status" = 'live' AND g."hosted_at" != '';
