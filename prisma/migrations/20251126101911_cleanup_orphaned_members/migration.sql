-- Clean up orphaned members that are not associated with any member list
-- This migration removes members that exist but are not linked to any member list

DELETE FROM Member
WHERE id NOT IN (
    SELECT A FROM _MemberListsOnMembers
);

-- The foreign key constraints will automatically clean up related Response and Answer records