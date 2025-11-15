// Shared in-memory store for password reset tokens
// In production, you should store these in a database table
export const resetTokens = new Map<string, { email: string; expires: Date }>()
