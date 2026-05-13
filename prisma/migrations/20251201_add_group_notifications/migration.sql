-- Migration: Add groupNotificationsEnabled to Survey
ALTER TABLE "Survey" ADD COLUMN "groupNotificationsEnabled" BOOLEAN NOT NULL DEFAULT 1;
