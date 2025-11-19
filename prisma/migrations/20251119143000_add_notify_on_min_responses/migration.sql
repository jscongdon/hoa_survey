-- Add notifyOnMinResponses boolean and minimalNotifiedAt datetime to Survey
PRAGMA foreign_keys=off;
BEGIN TRANSACTION;
ALTER TABLE "Survey" ADD COLUMN "notifyOnMinResponses" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Survey" ADD COLUMN "minimalNotifiedAt" DATETIME;
COMMIT;
PRAGMA foreign_keys=on;
