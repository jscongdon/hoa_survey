import { describe, it, expect, vi } from "vitest";
import * as sendModule from "@/lib/email/send";

describe("sendBulkEmails", () => {
  it("sends a batch of emails and returns results", async () => {
    // stub createTransporter to return fake transporter
    const fakeTransporter = {
      sendMail: vi.fn().mockResolvedValue({ messageId: "fake-id" }),
      close: vi.fn(),
    } as any;

    // Spy on createTransporter and stub it
    const createTransporterSpy = vi
      .spyOn(sendModule as any, "createTransporter" as any)
      .mockResolvedValue(fakeTransporter);
    const items = [
      {
        options: { to: "a@example.com", subject: "Subj", html: "<p>hi</p>" },
        meta: { id: 1 },
      },
      {
        options: { to: "b@example.com", subject: "Subj2", html: "<p>hi2</p>" },
        meta: { id: 2 },
      },
    ];

    const results = await sendModule.sendBulkEmails(items, {
      batchSize: 2,
      delayMsBetweenBatches: 0,
      retryCount: 0,
      transporter: fakeTransporter,
    });
    expect(results.length).toBe(2);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(fakeTransporter.sendMail.mock.calls.length).toBe(2);

    createTransporterSpy.mockRestore();
  });
});
