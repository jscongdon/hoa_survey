declare global {
  var pendingVerifications: Map<string, { email: string; expires: number }> | undefined
}

export {}
