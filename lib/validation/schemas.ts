import { z } from "zod";

// User registration/login
export const userSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const inviteAdminSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(1, "Name is required"),
  role: z.enum(["FULL", "VIEW_ONLY"]),
});

// Survey creation/edit
export const surveySchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  opensAt: z.string().optional(),
  closesAt: z.string().optional(),
  questions: z.array(
    z.object({
      text: z.string().min(1, "Question text is required"),
      type: z.string(),
      options: z.array(z.string()).optional(),
      writeIn: z.boolean().optional(),
      maxSelections: z.number().int().positive().optional(),
      // Optional conditional display rule
      showWhen: z
        .object({
          triggerOrder: z.number().int().nonnegative(),
          operator: z.enum(["equals", "contains"]),
          value: z.string(),
        })
        .optional(),
      required: z.boolean().optional(),
      order: z.number().int(),
    })
  ),
});

export const createSurveySchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  opensAt: z.date(),
  closesAt: z.date(),
  memberListId: z.string().uuid(),
  showLive: z.boolean().default(false),
  showAfterClose: z.boolean().default(true),
});

// Question validation (used in SurveyBuilder)
export const questionSchema = z.object({
  type: z.enum([
    "MULTI_SINGLE",
    "MULTI_MULTI",
    "YES_NO",
    "RATING_5",
    "PARAGRAPH",
  ]),
  text: z.string().min(1, "Question text is required"),
  options: z.array(z.string()).optional(),
  writeIn: z.boolean().optional(),
  maxSelections: z.number().int().positive().optional(),
  showWhen: z
    .object({
      triggerOrder: z.number().int().nonnegative(),
      operator: z.enum(["equals", "contains"]),
      value: z.string(),
    })
    .optional(),
  required: z.boolean().optional(),
  order: z.number(),
});

export const csvMemberSchema = z.object({
  lot: z.string(),
  name: z.string(),
  email: z.string().email(),
  address: z.string().optional(),
});

// Member invite
export const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "member"]),
});

// Survey response
export const responseSchema = z.object({
  surveyId: z.string(),
  answers: z.array(
    z.object({
      questionId: z.string(),
      value: z.any(),
    })
  ),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type InviteAdminInput = z.infer<typeof inviteAdminSchema>;
export type CreateSurveyInput = z.infer<typeof createSurveySchema>;
export type QuestionInput = z.infer<typeof questionSchema>;
export type CSVMember = z.infer<typeof csvMemberSchema>;
