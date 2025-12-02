/* @vitest-environment jsdom */
import React from "react";
import { vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DashboardSurveyPreviewPage from "@/app/dashboard/surveys/preview/page";

// Mock fetch for member-lists and sanitize endpoint
beforeEach(() => {
  global.fetch = vi.fn((url) => {
    if ((url as string).includes("/api/member-lists")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      } as any);
    }
    if ((url as string).includes("/api/sanitize")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ sanitized: "<p>Safe content</p>" }),
      } as any);
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
    } as any);
  }) as any;
});

afterEach(() => {
  // @ts-ignore
  global.fetch = undefined;
});

// NOTE: modal preview removed; using new-tab preview testing below.
test("opens preview and preview page shows sanitized description", async () => {
  const payload = {
    title: "Survey Title",
    description: "<script>alert(1)</script><p>Safe content</p>",
    questions: [],
  };

  // store payload in sessionStorage as the Preview button would
  sessionStorage.setItem("hoa:surveyPreview", JSON.stringify(payload));

  // Render the preview page directly - it should call /api/sanitize
  render(<DashboardSurveyPreviewPage />);

  await waitFor(() => {
    screen.getByText(/Survey Preview/);
  });

  // wait for sanitized content to render
  await waitFor(() => {
    screen.getByText(/Safe content/);
  });
});
