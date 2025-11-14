import { prisma } from '@/lib/prisma'

/**
 * Check if adminId can manage targetAdminId based on invite hierarchy
 * Rules:
 * - Can manage anyone they directly invited
 * - Can manage anyone invited by their invitees (recursively)
 * - Cannot manage who invited them or anyone up the chain
 */
export async function canManageAdmin(adminId: string, targetAdminId: string): Promise<boolean> {
  if (adminId === targetAdminId) {
    return false // Cannot manage yourself for delete/modify operations
  }

  // Get the target admin's invite chain (who invited them)
  const targetAdmin = await prisma.admin.findUnique({
    where: { id: targetAdminId },
    select: { invitedById: true },
  })

  if (!targetAdmin) {
    return false
  }

  // Check if adminId is in the target's downward tree (adminId invited target or their ancestors)
  return await isInInviteTree(adminId, targetAdminId)
}

/**
 * Recursively check if ancestorId invited descendantId or any of descendantId's ancestors
 */
async function isInInviteTree(ancestorId: string, descendantId: string): Promise<boolean> {
  const descendant = await prisma.admin.findUnique({
    where: { id: descendantId },
    select: { invitedById: true },
  })

  if (!descendant) {
    return false
  }

  // If ancestor directly invited descendant
  if (descendant.invitedById === ancestorId) {
    return true
  }

  // If descendant has no inviter, we've reached the top
  if (!descendant.invitedById) {
    return false
  }

  // Recursively check up the tree
  return await isInInviteTree(ancestorId, descendant.invitedById)
}

/**
 * Get all admins that a given admin can manage (their invitees and descendants)
 */
export async function getManagedAdmins(adminId: string): Promise<string[]> {
  const managedIds: string[] = []
  
  // Get all admins
  const allAdmins = await prisma.admin.findMany({
    select: { id: true, invitedById: true },
  })

  // Check each admin
  for (const admin of allAdmins) {
    if (admin.id !== adminId && await isInInviteTree(adminId, admin.id)) {
      managedIds.push(admin.id)
    }
  }

  return managedIds
}
