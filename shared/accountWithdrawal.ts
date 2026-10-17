import { z } from "zod";

export const accountWithdrawalSchema = z.object({
  confirmation: z.literal("DELETE"),
  acknowledged: z.literal(true),
  password: z.string().max(128).optional(),
}).strict();
export type AccountWithdrawalInput = z.infer<typeof accountWithdrawalSchema>;
