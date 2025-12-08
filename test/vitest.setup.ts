import { vi } from "vitest";

// Provide a default mock for verifyToken to be overridden in tests
vi.mock("@/lib/auth/jwt", () => ({
  verifyToken: vi
    .fn()
    .mockResolvedValue({ adminId: "test-admin", role: "FULL" }),
}));
