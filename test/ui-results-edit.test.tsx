/* @vitest-environment jsdom */
import React from "react";
import { describe, it, beforeEach, afterEach, expect, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SurveyResultsPage from "@/app/dashboard/surveys/[id]/results/page";

beforeEach(() => {
  vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
  global.fetch = vi.fn((url, opts) => {
    if ((url as string).includes("/api/auth/me")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ role: "FULL" }),
      } as any);
    }
    if ((url as string).includes("/api/surveys/")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            survey: {
              id: "s1",
              title: "Test Survey",
              description: null,
              opensAt: new Date().toISOString(),
              closesAt: new Date(Date.now() + 3600000).toISOString(),
              totalResponses: 1,
            },
            questions: [
              {
                id: "q1",
                text: "Q1",
                type: "MULTI_SINGLE",
                options: ["A", "B"],
                required: false,
              },
            ],
            stats: [],
            responses: [
              {
                id: "r1",
                member: { lot: "101", name: "Alice" },
                answers: { q1: "A" },
                submittedAt: new Date().toISOString(),
                token: "t1",
              },
            ],
          }),
      } as any);
    }
    // handle PUT update
    if (
      (url as string).includes("/api/surveys/") &&
      opts &&
      (opts as any).method === "PUT"
    ) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
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

it("allows admin to edit a response's answer inline via modal", async () => {
  render(<SurveyResultsPage params={Promise.resolve({ id: "s1" })} />);
  await waitFor(() => screen.getByText(/Individual Responses/i));

  // Show individual responses
  await waitFor(() => screen.getAllByText(/Alice/));
  // click Edit for Alice
  const editBtns = screen.getAllByText(/Edit/i);
  expect(editBtns.length).toBeGreaterThan(0);
  await userEvent.click(editBtns[0]);

  // Wait for modal showing Q1
  await waitFor(() => screen.getByText(/Edit Response - Alice/));
  await waitFor(() => screen.getByText(/Q1/));

  // Modal container should include dark mode class for background
  const modal = screen.getByTestId("edit-response-modal");
  expect(modal).toBeTruthy();
  expect(modal.className).toContain("dark:bg-gray-800");

  // Change answer to 'B'
  const radioB = screen.getByLabelText(/B/);
  await userEvent.click(radioB);

  // Submit via SurveyRenderer 'Submit' button inside modal
  const allSubmit = screen.getAllByText(/Submit/i);
  const submitBtn = allSubmit.find((el) => el.tagName === "BUTTON");
  expect(submitBtn).toBeTruthy();
  await userEvent.click(submitBtn);

  // Wait for modal to close
  await waitFor(() =>
    expect(screen.queryByText(/Edit Response - Alice/)).toBeNull()
  );
});
