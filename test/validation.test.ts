import { describe, it, expect } from "vitest";
import {
  userSchema,
  loginSchema,
  surveySchema,
  questionSchema,
  inviteSchema,
  responseSchema,
} from "../lib/validation/schemas";

// User schema tests
describe("userSchema", () => {
  it("validates a correct user", () => {
    expect(() =>
      userSchema.parse({ email: "a@b.com", password: "password123" })
    ).not.toThrow();
  });
  it("rejects invalid email", () => {
    expect(() =>
      userSchema.parse({ email: "bad", password: "password123" })
    ).toThrow();
  });
  it("rejects short password", () => {
    expect(() =>
      userSchema.parse({ email: "a@b.com", password: "short" })
    ).toThrow();
  });
});

describe("loginSchema", () => {
  it("validates correct login", () => {
    expect(() =>
      loginSchema.parse({ email: "a@b.com", password: "password123" })
    ).not.toThrow();
  });
  it("rejects missing password", () => {
    expect(() => loginSchema.parse({ email: "a@b.com" })).toThrow();
  });
});

describe("questionSchema", () => {
  it("validates a text question", () => {
    expect(() =>
      questionSchema.parse({
        type: "PARAGRAPH",
        text: "Describe your experience",
        order: 0,
      })
    ).not.toThrow();
  });
  it("rejects missing text", () => {
    expect(() =>
      questionSchema.parse({ type: "PARAGRAPH", order: 0 })
    ).toThrow();
  });
});

describe("surveySchema", () => {
  it("validates a survey with questions", () => {
    expect(() =>
      surveySchema.parse({
        title: "Test",
        questions: [
          { text: "Q1", type: "PARAGRAPH", order: 0 },
          { text: "Q2", type: "MULTI_SINGLE", order: 1, options: ["A", "B"] },
        ],
      })
    ).not.toThrow();
  });
  it("rejects missing title", () => {
    expect(() => surveySchema.parse({ questions: [] })).toThrow();
  });
});

describe("inviteSchema", () => {
  it("validates admin invite", () => {
    expect(() =>
      inviteSchema.parse({ email: "a@b.com", role: "admin" })
    ).not.toThrow();
  });
  it("rejects bad email", () => {
    expect(() => inviteSchema.parse({ email: "bad", role: "admin" })).toThrow();
  });
});

describe("responseSchema", () => {
  it("validates a response", () => {
    expect(() =>
      responseSchema.parse({
        surveyId: "abc",
        answers: [{ questionId: "q1", value: "foo" }],
      })
    ).not.toThrow();
  });
  it("rejects missing answers", () => {
    expect(() => responseSchema.parse({ surveyId: "abc" })).toThrow();
  });
});
