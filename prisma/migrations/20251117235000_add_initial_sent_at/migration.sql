-- Add initialSentAt column to Survey
PRAGMA foreign_keys=off;
BEGIN TRANSACTION;
ALTER TABLE "Survey" ADD COLUMN "initialSentAt" DATETIME;
COMMIT;
PRAGMA foreign_keys=on;
