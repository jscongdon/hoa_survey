-- AlterTable
ALTER TABLE "Member" ADD COLUMN "createdAt" TEXT;

-- AlterTable
ALTER TABLE "MemberList" ADD COLUMN "createdAt" TEXT;

-- AlterTable
ALTER TABLE "Admin" ADD COLUMN "createdAt" TEXT;

-- AlterTable
ALTER TABLE "Survey" ADD COLUMN "createdAt" TEXT;

-- AlterTable
ALTER TABLE "Response" ADD COLUMN "createdAt" TEXT;

-- AlterTable
ALTER TABLE "Answer" ADD COLUMN "createdAt" TEXT;

-- AlterTable
ALTER TABLE "SystemConfig" ADD COLUMN "createdAt" TEXT;

-- Update existing rows to have a createdAt value with DT: prefix
-- Handle both NULL values and existing datetime strings
UPDATE "Member" SET "createdAt" = 'DT:' || strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE "createdAt" IS NULL;
UPDATE "MemberList" SET "createdAt" = 'DT:' || strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE "createdAt" IS NULL;
UPDATE "Admin" SET "createdAt" = 'DT:' || strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE "createdAt" IS NULL;
UPDATE "Survey" SET "createdAt" = 'DT:' || strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE "createdAt" IS NULL;
UPDATE "Response" SET "createdAt" = 'DT:' || strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE "createdAt" IS NULL;
UPDATE "Answer" SET "createdAt" = 'DT:' || strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE "createdAt" IS NULL;
UPDATE "SystemConfig" SET "createdAt" = 'DT:' || strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE "createdAt" IS NULL;

-- Convert any existing ISO datetime strings to DT: prefixed format
UPDATE "Member" SET "createdAt" = 'DT:' || "createdAt"
  WHERE "createdAt" IS NOT NULL AND NOT ("createdAt" GLOB 'DT:*');

UPDATE "MemberList" SET "createdAt" = 'DT:' || "createdAt"
  WHERE "createdAt" IS NOT NULL AND NOT ("createdAt" GLOB 'DT:*');

UPDATE "Admin" SET "createdAt" = 'DT:' || "createdAt"
  WHERE "createdAt" IS NOT NULL AND NOT ("createdAt" GLOB 'DT:*');

UPDATE "Survey" SET "createdAt" = 'DT:' || "createdAt"
  WHERE "createdAt" IS NOT NULL AND NOT ("createdAt" GLOB 'DT:*');

UPDATE "Response" SET "createdAt" = 'DT:' || "createdAt"
  WHERE "createdAt" IS NOT NULL AND NOT ("createdAt" GLOB 'DT:*');

UPDATE "Answer" SET "createdAt" = 'DT:' || "createdAt"
  WHERE "createdAt" IS NOT NULL AND NOT ("createdAt" GLOB 'DT:*');

UPDATE "SystemConfig" SET "createdAt" = 'DT:' || "createdAt"
  WHERE "createdAt" IS NOT NULL AND NOT ("createdAt" GLOB 'DT:*');