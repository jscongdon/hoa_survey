-- AlterTable - change existing DATETIME columns to TEXT
-- SystemConfig, Admin, and MemberList already have createdAt as DATETIME from init migration
-- We need to convert them to TEXT format

-- First, convert existing DATETIME values to DT: prefixed ISO strings for existing tables
UPDATE "SystemConfig" SET "createdAt" = 'DT:' || strftime('%Y-%m-%dT%H:%M:%fZ', "createdAt") WHERE "createdAt" IS NOT NULL;
UPDATE "Admin" SET "createdAt" = 'DT:' || strftime('%Y-%m-%dT%H:%M:%fZ', "createdAt") WHERE "createdAt" IS NOT NULL;
UPDATE "MemberList" SET "createdAt" = 'DT:' || strftime('%Y-%m-%dT%H:%M:%fZ', "createdAt") WHERE "createdAt" IS NOT NULL;

-- Add createdAt column to tables that don't have it
ALTER TABLE "Member" ADD COLUMN "createdAt" TEXT;
ALTER TABLE "Survey" ADD COLUMN "createdAt" TEXT;
ALTER TABLE "Response" ADD COLUMN "createdAt" TEXT;
ALTER TABLE "Answer" ADD COLUMN "createdAt" TEXT;

-- Set createdAt for new columns (tables that didn't have createdAt before)
UPDATE "Member" SET "createdAt" = 'DT:' || strftime('%Y-%m-%dT%H:%M:%fZ', 'now');
UPDATE "Survey" SET "createdAt" = 'DT:' || strftime('%Y-%m-%dT%H:%M:%fZ', 'now');
UPDATE "Response" SET "createdAt" = 'DT:' || strftime('%Y-%m-%dT%H:%M:%fZ', 'now');
UPDATE "Answer" SET "createdAt" = 'DT:' || strftime('%Y-%m-%dT%H:%M:%fZ', 'now');