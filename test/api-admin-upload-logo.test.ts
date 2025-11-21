import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// Mock dependencies
vi.mock("../lib/auth/jwt", () => ({
  verifyToken: vi.fn(),
}));

vi.mock("../lib/prisma", () => ({
  default: {
    systemConfig: {
      upsert: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock("fs", () => ({
  __esModule: true,
  default: {
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
  },
}));

vi.mock("path", () => ({
  __esModule: true,
  default: {
    join: vi.fn(),
  },
}));

vi.mock("../lib/logger", () => ({
  error: vi.fn(),
}));

import {
  POST as uploadLogoPost,
  DELETE as uploadLogoDelete,
} from "../app/api/admin/upload-logo/route";
import { verifyToken } from "../lib/auth/jwt";
import prisma from "../lib/prisma";
import * as fs from "fs";
import path from "path";
import path from "path";

describe("Admin Upload Logo API - /api/admin/upload-logo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-11-20T10:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("POST /api/admin/upload-logo", () => {
    it("successfully uploads PNG logo with valid authentication", async () => {
      // Mock authentication
      (verifyToken as any).mockResolvedValue({ adminId: "admin1" });

      // Mock file system
      let existsSyncCallCount = 0;
      (fs.default.existsSync as any).mockImplementation((path: string) => {
        existsSyncCallCount++;
        if (path.includes("public/uploads")) {
          return existsSyncCallCount > 1; // false for directory check, true for file check
        }
        return false;
      });
      (fs.default.mkdirSync as any).mockImplementation(() => {});
      (fs.default.writeFileSync as any).mockImplementation(() => {});
      (path.join as any).mockImplementation((...args: string[]) =>
        args.join("/")
      );

      // Mock database
      (prisma.systemConfig.upsert as any).mockResolvedValue({
        id: "system",
        hoaLogoUrl: "/uploads/hoa-logo-1732094400000-abc123.png",
      });

      const req = new NextRequest(
        "http://localhost:3000/api/admin/upload-logo",
        {
          method: "POST",
          headers: {
            cookie: "auth-token=valid-token",
          },
        }
      );

      // Mock formData method
      const pngHeader = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]); // PNG signature
      const pngData = Buffer.concat([pngHeader, Buffer.alloc(1016)]); // Total 1024 bytes
      const mockFile = {
        name: "logo.png",
        type: "image/png",
        size: 1024,
        arrayBuffer: async () =>
          pngData.buffer.slice(
            pngData.byteOffset,
            pngData.byteOffset + pngData.byteLength
          ),
      };
      const mockForm = {
        get: vi.fn().mockReturnValue(mockFile),
      };
      req.formData = vi.fn().mockResolvedValue(mockForm);

      const res = await uploadLogoPost(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.url).toMatch(/^\/uploads\/hoa-logo-\d+-[a-z0-9]+\.png$/);
      expect(body.path).toContain("public/uploads/");
      expect(body.saved).toBe(true);

      expect(verifyToken).toHaveBeenCalledWith("valid-token");
      expect(prisma.systemConfig.upsert).toHaveBeenCalledWith({
        where: { id: "system" },
        update: {
          hoaLogoUrl: expect.stringMatching(
            /^\/uploads\/hoa-logo-\d+-[a-z0-9]+\.png$/
          ),
        },
        create: {
          id: "system",
          hoaLogoUrl: expect.stringMatching(
            /^\/uploads\/hoa-logo-\d+-[a-z0-9]+\.png$/
          ),
        },
      });
    });

    it("successfully uploads JPEG logo", async () => {
      (verifyToken as any).mockResolvedValue({ adminId: "admin1" });
      (fs.default.existsSync as any).mockReturnValue(true);
      (path.join as any).mockImplementation((...args: string[]) =>
        args.join("/")
      );
      (prisma.systemConfig.upsert as any).mockResolvedValue({
        id: "system",
        hoaLogoUrl: "/uploads/hoa-logo-1732094400000-abc123.jpg",
      });

      // Create JPEG file (starts with 0xFF 0xD8 0xFF)
      const jpegBuffer = Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
      ]);
      const mockFile = {
        name: "logo.jpg",
        type: "image/jpeg",
        size: jpegBuffer.length,
        arrayBuffer: async () =>
          jpegBuffer.buffer.slice(
            jpegBuffer.byteOffset,
            jpegBuffer.byteOffset + jpegBuffer.byteLength
          ),
      };

      const formData = new FormData();
      formData.append("file", mockFile as any);

      const req = new NextRequest(
        "http://localhost:3000/api/admin/upload-logo",
        {
          method: "POST",
          body: formData,
          headers: {
            cookie: "auth-token=valid-token",
          },
        }
      );

      // Mock formData
      const mockForm = {
        get: vi.fn().mockReturnValue(mockFile),
      };
      req.formData = vi.fn().mockResolvedValue(mockForm);

      const res = await uploadLogoPost(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.url).toMatch(/\.jpg$/);
    });

    it("successfully uploads SVG logo", async () => {
      (verifyToken as any).mockResolvedValue({ adminId: "admin1" });
      (fs.default.existsSync as any).mockReturnValue(true);
      (path.join as any).mockImplementation((...args: string[]) =>
        args.join("/")
      );
      (prisma.systemConfig.upsert as any).mockResolvedValue({
        id: "system",
        hoaLogoUrl: "/uploads/hoa-logo-1732094400000-abc123.svg",
      });

      const svgContent =
        '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40"/></svg>';
      const mockFile = {
        name: "logo.svg",
        type: "image/svg+xml",
        size: svgContent.length,
        arrayBuffer: async () => Buffer.from(svgContent),
      };

      const formData = new FormData();
      formData.append("file", mockFile as any);

      const req = new NextRequest(
        "http://localhost:3000/api/admin/upload-logo",
        {
          method: "POST",
          body: formData,
          headers: {
            cookie: "auth-token=valid-token",
          },
        }
      );

      // Mock formData
      const mockForm = {
        get: vi.fn().mockReturnValue(mockFile),
      };
      req.formData = vi.fn().mockResolvedValue(mockForm);

      const res = await uploadLogoPost(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.url).toMatch(/\.svg$/);
    });

    it("returns 401 when not authenticated", async () => {
      const req = new NextRequest(
        "http://localhost:3000/api/admin/upload-logo",
        {
          method: "POST",
        }
      );

      const res = await uploadLogoPost(req);
      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body.error).toBe("Unauthorized");
    });

    it("returns 401 with invalid token", async () => {
      (verifyToken as any).mockResolvedValue(null);

      const req = new NextRequest(
        "http://localhost:3000/api/admin/upload-logo",
        {
          method: "POST",
          headers: {
            cookie: "auth-token=invalid-token",
          },
        }
      );

      const res = await uploadLogoPost(req);
      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body.error).toBe("Unauthorized");
    });

    it("returns 413 when content-length header indicates file too large", async () => {
      (verifyToken as any).mockResolvedValue({ adminId: "admin1" });

      const req = new NextRequest(
        "http://localhost:3000/api/admin/upload-logo",
        {
          method: "POST",
          headers: {
            "content-length": "3000000", // 3MB > 2MB limit
            cookie: "auth-token=valid-token",
          },
        }
      );

      const res = await uploadLogoPost(req);
      expect(res.status).toBe(413);

      const body = await res.json();
      expect(body.error).toBe("Payload too large");
    });

    it("returns 400 when no file uploaded", async () => {
      (verifyToken as any).mockResolvedValue({ adminId: "admin1" });

      const formData = new FormData();

      const req = new NextRequest(
        "http://localhost:3000/api/admin/upload-logo",
        {
          method: "POST",
          body: formData,
          headers: {
            cookie: "auth-token=valid-token",
          },
        }
      );

      const res = await uploadLogoPost(req);
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.error).toBe("No file uploaded");
    });

    it("returns 413 when file buffer is too large", async () => {
      (verifyToken as any).mockResolvedValue({ adminId: "admin1" });

      const largeBuffer = new ArrayBuffer(3 * 1024 * 1024); // 3MB
      const mockFile = {
        name: "large.png",
        type: "image/png",
        size: largeBuffer.byteLength,
        arrayBuffer: async () => largeBuffer,
      };

      const formData = new FormData();
      formData.append("file", mockFile as any);

      const req = new NextRequest(
        "http://localhost:3000/api/admin/upload-logo",
        {
          method: "POST",
          body: formData,
          headers: {
            cookie: "auth-token=valid-token",
          },
        }
      );

      // Mock formData
      const mockForm = {
        get: vi.fn().mockReturnValue(mockFile),
      };
      req.formData = vi.fn().mockResolvedValue(mockForm);

      const res = await uploadLogoPost(req);
      expect(res.status).toBe(413);

      const body = await res.json();
      expect(body.error).toBe("File too large (max 2MB)");
    });

    it("returns 415 for invalid file type", async () => {
      (verifyToken as any).mockResolvedValue({ adminId: "admin1" });

      const mockFile = {
        name: "text.txt",
        type: "text/plain",
        size: 100,
        arrayBuffer: async () => new TextEncoder().encode("Hello world").buffer,
      };

      const formData = new FormData();
      formData.append("file", mockFile as any);

      const req = new NextRequest(
        "http://localhost:3000/api/admin/upload-logo",
        {
          method: "POST",
          body: formData,
          headers: {
            cookie: "auth-token=valid-token",
          },
        }
      );
      req.formData = vi.fn().mockResolvedValue({
        get: vi.fn().mockReturnValue(mockFile),
      });

      const res = await uploadLogoPost(req);
      expect(res.status).toBe(415);

      const body = await res.json();
      expect(body.error).toBe("Invalid or unsupported file type");
    });

    it("returns 500 on database error", async () => {
      (verifyToken as any).mockResolvedValue({ adminId: "admin1" });
      (fs.default.existsSync as any).mockReturnValue(true);
      (path.join as any).mockImplementation((...args: string[]) =>
        args.join("/")
      );
      (prisma.systemConfig.upsert as any).mockRejectedValue(
        new Error("DB Error")
      );

      const mockFile = {
        name: "logo.png",
        type: "image/png",
        size: 1024,
        arrayBuffer: async () => {
          const buffer = Buffer.alloc(1024);
          buffer[0] = 0x89;
          buffer[1] = 0x50;
          buffer[2] = 0x4e;
          buffer[3] = 0x47;
          buffer[4] = 0x0d;
          buffer[5] = 0x0a;
          buffer[6] = 0x1a;
          buffer[7] = 0x0a;
          return buffer;
        },
      };

      const formData = new FormData();
      formData.append("file", mockFile as any);

      const req = new NextRequest(
        "http://localhost:3000/api/admin/upload-logo",
        {
          method: "POST",
          body: formData,
          headers: {
            cookie: "auth-token=valid-token",
          },
        }
      );

      // Mock formData
      const mockForm = {
        get: vi.fn().mockReturnValue(mockFile),
      };
      req.formData = vi.fn().mockResolvedValue(mockForm);

      const res = await uploadLogoPost(req);
      expect(res.status).toBe(500);

      const body = await res.json();
      expect(body.error).toBe("Failed to upload logo");
    });
  });

  describe("DELETE /api/admin/upload-logo", () => {
    it("successfully deletes existing logo", async () => {
      (verifyToken as any).mockResolvedValue({ adminId: "admin1" });
      (prisma.systemConfig.findUnique as any).mockResolvedValue({
        id: "system",
        hoaLogoUrl: "/uploads/old-logo.png",
      });
      (fs.default.existsSync as any).mockReturnValue(true);
      (path.join as any).mockImplementation((...args: string[]) =>
        args.join("/")
      );
      (prisma.systemConfig.upsert as any).mockResolvedValue({
        id: "system",
        hoaLogoUrl: null,
      });

      const req = new NextRequest(
        "http://localhost:3000/api/admin/upload-logo",
        {
          method: "DELETE",
          headers: {
            cookie: "auth-token=valid-token",
          },
        }
      );

      const res = await uploadLogoDelete(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);

      expect(fs.default.unlinkSync).toHaveBeenCalled();
      expect(prisma.systemConfig.upsert).toHaveBeenCalledWith({
        where: { id: "system" },
        update: { hoaLogoUrl: null },
        create: { id: "system" },
      });
    });

    it("handles deletion when no logo exists", async () => {
      (verifyToken as any).mockResolvedValue({ adminId: "admin1" });
      (prisma.systemConfig.findUnique as any).mockResolvedValue({
        id: "system",
        hoaLogoUrl: null,
      });
      (prisma.systemConfig.upsert as any).mockResolvedValue({
        id: "system",
        hoaLogoUrl: null,
      });

      const req = new NextRequest(
        "http://localhost:3000/api/admin/upload-logo",
        {
          method: "DELETE",
          headers: {
            cookie: "auth-token=valid-token",
          },
        }
      );

      const res = await uploadLogoDelete(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);

      expect(fs.default.unlinkSync).not.toHaveBeenCalled();
    });

    it("returns 401 when not authenticated", async () => {
      const req = new NextRequest(
        "http://localhost:3000/api/admin/upload-logo",
        {
          method: "DELETE",
        }
      );

      const res = await uploadLogoDelete(req);
      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body.error).toBe("Unauthorized");
    });

    it("returns 401 with invalid token", async () => {
      (verifyToken as any).mockResolvedValue(null);

      const req = new NextRequest(
        "http://localhost:3000/api/admin/upload-logo",
        {
          method: "DELETE",
          headers: {
            cookie: "auth-token=invalid-token",
          },
        }
      );

      const res = await uploadLogoDelete(req);
      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body.error).toBe("Unauthorized");
    });

    it("returns 500 on database error during find", async () => {
      (verifyToken as any).mockResolvedValue({ adminId: "admin1" });
      (prisma.systemConfig.findUnique as any).mockRejectedValue(
        new Error("DB Error")
      );

      const req = new NextRequest(
        "http://localhost:3000/api/admin/upload-logo",
        {
          method: "DELETE",
          headers: {
            cookie: "auth-token=valid-token",
          },
        }
      );

      const res = await uploadLogoDelete(req);
      expect(res.status).toBe(500);

      const body = await res.json();
      expect(body.error).toBe("Failed to remove logo");
    });

    it("returns 500 on database error during upsert", async () => {
      (verifyToken as any).mockResolvedValue({ adminId: "admin1" });
      (prisma.systemConfig.findUnique as any).mockResolvedValue({
        id: "system",
        hoaLogoUrl: "/uploads/old-logo.png",
      });
      (fs.default.existsSync as any).mockReturnValue(true);
      (path.join as any).mockImplementation((...args: string[]) =>
        args.join("/")
      );
      (prisma.systemConfig.upsert as any).mockRejectedValue(
        new Error("DB Error")
      );

      const req = new NextRequest(
        "http://localhost:3000/api/admin/upload-logo",
        {
          method: "DELETE",
          headers: {
            cookie: "auth-token=valid-token",
          },
        }
      );

      const res = await uploadLogoDelete(req);
      expect(res.status).toBe(500);

      const body = await res.json();
      expect(body.error).toBe("Failed to remove logo");
    });
  });
});
