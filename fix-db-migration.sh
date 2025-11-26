#!/bin/bash

# Script to fix createdAt field format in existing database
# Run this in the remote deployment container

echo "Fixing createdAt fields in database..."

# Convert SystemConfig createdAt from Unix timestamp to DT: format
sqlite3 /data/hoasurvey.db "UPDATE SystemConfig SET createdAt = 'DT:' || datetime(createdAt/1000, 'unixepoch') || 'Z' WHERE createdAt NOT GLOB 'DT:*';"

# Convert Admin createdAt from Unix timestamp to DT: format
sqlite3 /data/hoasurvey.db "UPDATE Admin SET createdAt = 'DT:' || datetime(createdAt/1000, 'unixepoch') || 'Z' WHERE createdAt NOT GLOB 'DT:*';"

# Convert MemberList createdAt from Unix timestamp to DT: format
sqlite3 /data/hoasurvey.db "UPDATE MemberList SET createdAt = 'DT:' || datetime(createdAt/1000, 'unixepoch') || 'Z' WHERE createdAt NOT GLOB 'DT:*';"

# Add createdAt columns to tables that don't have them
sqlite3 /data/hoasurvey.db "ALTER TABLE Member ADD COLUMN createdAt TEXT;"
sqlite3 /data/hoasurvey.db "ALTER TABLE Survey ADD COLUMN createdAt TEXT;"
sqlite3 /data/hoasurvey.db "ALTER TABLE Response ADD COLUMN createdAt TEXT;"
sqlite3 /data/hoasurvey.db "ALTER TABLE Answer ADD COLUMN createdAt TEXT;"

# Set default values for new createdAt columns
sqlite3 /data/hoasurvey.db "UPDATE Member SET createdAt = 'DT:' || datetime('now') || 'Z' WHERE createdAt IS NULL;"
sqlite3 /data/hoasurvey.db "UPDATE Survey SET createdAt = 'DT:' || datetime('now') || 'Z' WHERE createdAt IS NULL;"
sqlite3 /data/hoasurvey.db "UPDATE Response SET createdAt = 'DT:' || datetime('now') || 'Z' WHERE createdAt IS NULL;"
sqlite3 /data/hoasurvey.db "UPDATE Answer SET createdAt = 'DT:' || datetime('now') || 'Z' WHERE createdAt IS NULL;"

echo "Database migration completed!"
echo "Restart the application container to apply changes."