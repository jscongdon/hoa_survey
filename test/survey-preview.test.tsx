/* @vitest-environment jsdom */
import React from "react";
import { vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SurveyForm from "@/components/SurveyForm";

// Mock fetch for member-lists and sanitize endpoint
beforeEach(() => {
  global.fetch = vi.fn((url) => {
    if ((url as string).includes("/api/member-lists")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as any);
    }
    if ((url as string).includes("/api/sanitize")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ sanitized: "<p>Safe content</p>" }) } as any);
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as any);
  }) as any;
});

afterEach(() => {
  // @ts-ignore
  global.fetch = undefined;
});

test("opens preview modal and shows sanitized description", async () => {
  render(
    <SurveyForm
      mode="create"
      initialValues={{
        title: "Survey Title",
        description: "<script>alert(1)</script><p>Safe content</p>",
      }}
      onSubmit={async () => {}}
    />
  );

  const previewButton = screen.getByRole("button", { name: /Preview/i });
  fireEvent.click(previewButton);

  await waitFor(() => {
    screen.getByText(/Preview Survey/);
  });

  await waitFor(() => {
    screen.getByText(/Safe content/);
  });
});
