-- Alter Admin table to add inviteExpires column for tracking invite expiry
ALTER TABLE "Admin" ADD COLUMN "inviteExpires" DATETIME;
