/* @vitest-environment jsdom */
import React from "react";
import { describe, it, beforeEach, afterEach, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import StreamingNonRespondents from "@/app/dashboard/surveys/[id]/nonrespondents/StreamingNonRespondents";

beforeEach(() => {
  // clear localStorage
  // ensure we have a simple localStorage polyfill for tests
  // @ts-ignore
  if (!global.localStorage || typeof global.localStorage.getItem !== 'function') {
    // basic in-memory localStorage
    // @ts-ignore
    global.localStorage = (function () {
      let store: Record<string, string> = {};
      return {
        getItem: (key: string) => (store[key] === undefined ? null : store[key]),
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
  vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/dashboard/surveys/s1/nonrespondents", useParams: () => ({ id: 's1' }) }));
  vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: () => ({ refreshAuth: vi.fn() }) }));
});

afterEach(() => {
  // clear mocks
  // @ts-ignore
  global.fetch = undefined;
});

describe("Nonrespondents cache resync", () => {
  it("should resync when cache empty but server has items", async () => {
    // mock fetch to return server data when called
    // First, the component will call /api/surveys/s1/nonrespondents (load cached counts) and later for resync
    // Return array of one nonrespondent
    const sample = [{
      responseId: 'r1',
      id: 'm1',
      name: 'Alice',
      email: 'a@example.com',
      lotNumber: '101',
      address: '123 Main St',
      token: 't1',
      reminderCount: 0
    }];

    // Save empty cache to localStorage
    const key = 'nonrespondents:s1';
    localStorage.setItem(key, JSON.stringify({ items: [], seen: [], totalCount: 1, ts: Date.now() }));

    // Mock fetch for the server call used in resync
    global.fetch = vi.fn((url, opts) => {
      if ((url as string).includes('/api/surveys/s1/nonrespondents')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(sample) } as any);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as any);
    }) as any;

    render(<StreamingNonRespondents />);

    // wait for item to show
    await waitFor(() => screen.getByText(/Alice/));
    expect(screen.getByText(/Alice/)).toBeTruthy();
  });
});
