import { z } from "zod";

export const recoveryLanguageSchema = z.enum(["ko", "en", "ja"]);
export const recoveryTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const recoveryEnrollmentSchema = z.object({
  email: z.string().trim().max(320).email(),
  currentPassword: z.string().min(1).max(128),
  language: recoveryLanguageSchema.optional().default("ko"),
}).strict();
export const recoveryRequestSchema = z.object({
  purpose: z.enum(["password", "id"]),
  method: z.enum(["id", "email"]),
  identifier: z.string().trim().min(1).max(320),
  language: recoveryLanguageSchema,
}).strict().superRefine((input, ctx) => {
  if (input.method === "email" && !z.string().email().safeParse(input.identifier).success) {
    ctx.addIssue({ code: "custom", path: ["identifier"], message: "RECOVERY_EMAIL_INVALID" });
  }
  if (input.method === "id" && input.identifier.length > 64) {
    ctx.addIssue({ code: "custom", path: ["identifier"], message: "RECOVERY_ID_INVALID" });
  }
  if (input.purpose === "id" && input.method !== "email") {
    ctx.addIssue({ code: "custom", path: ["method"], message: "RECOVERY_ID_REQUIRES_EMAIL" });
  }
});
export const recoveryConfirmationSchema = z.object({ token: recoveryTokenSchema }).strict();
export const recoveryResetSchema = z.object({
  token: recoveryTokenSchema,
  password: z.string().min(10).max(128),
  confirmation: z.string().min(10).max(128),
}).strict().refine(input => input.password === input.confirmation, { path: ["confirmation"], message: "RECOVERY_PASSWORD_MISMATCH" });

export type RecoveryLanguage = z.infer<typeof recoveryLanguageSchema>;
export type RecoveryEnrollment = z.infer<typeof recoveryEnrollmentSchema>;
export type RecoveryRequest = z.infer<typeof recoveryRequestSchema>;
export type RecoveryReset = z.infer<typeof recoveryResetSchema>;
