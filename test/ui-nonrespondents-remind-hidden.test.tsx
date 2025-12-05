/* @vitest-environment jsdom */
import React from "react";
import { describe, it, beforeEach, afterEach, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import StreamingNonRespondents from "@/app/dashboard/surveys/[id]/nonrespondents/StreamingNonRespondents";

beforeEach(() => {
  // basic localStorage polyfill
  // @ts-ignore
  if (
    !global.localStorage ||
    typeof global.localStorage.getItem !== "function"
  ) {
    // @ts-ignore
    global.localStorage = (function () {
      let store: Record<string, string> = {};
      return {
        getItem: (key: string) =>
          store[key] === undefined ? null : store[key],
        setItem: (key: string, val: string) => {
          store[key] = String(val);
        },
        removeItem: (key: string) => {
          delete store[key];
        },
        clear: () => {
          store = {};
        },
        key: (i: number) => Object.keys(store)[i] || null,
        get length() {
          return Object.keys(store).length;
        },
      } as Storage;
    })();
  } else {
    // @ts-ignore
    Object.keys(localStorage || {}).forEach((k) => localStorage.removeItem(k));
  }
  vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn() }),
    usePathname: () => "/dashboard/surveys/s1/nonrespondents",
    useParams: () => ({ id: "s1" }),
  }));
  vi.mock("@/lib/auth/AuthContext", () => ({
    useAuth: () => ({ refreshAuth: vi.fn() }),
  }));
});

afterEach(() => {
  // clear mocked fetch
  // @ts-ignore
  global.fetch = undefined;
});

describe("Nonrespondents Remind button visibility", () => {
  it("does not show Remind button when email is empty", async () => {
    const sample = [
      {
        responseId: "r1",
        id: "m1",
        name: "Bob",
        email: "",
        lotNumber: "101",
        address: "",
        token: "t1",
        reminderCount: 0,
      },
    ];

    localStorage.setItem(
      "nonrespondents:s1",
      JSON.stringify({
        items: sample,
        seen: ["r1"],
        totalCount: 1,
        ts: Date.now(),
      })
    );

    global.fetch = vi.fn((url: any) => {
      if (
        typeof url === "string" &&
        url.indexOf("/api/surveys/s1/nonrespondents") !== -1
      ) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(sample),
        } as any);
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      } as any);
    }) as any;

    render(<StreamingNonRespondents />);

    await waitFor(() =>
      expect(screen.getAllByText(/Bob/).length).toBeGreaterThan(0)
    );

    // There should be no Remind button visible; match whole 'Remind' button label
    expect(screen.queryByText(/^Remind$/)).toBeNull();
  });
});
