-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "message_kind" VARCHAR(20);
