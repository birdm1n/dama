import { z } from "zod";

export const signUpSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "이름을 입력해 주세요.")
    .max(30, "이름은 30자 이하로 입력해 주세요."),
  email: z.string().trim().toLowerCase().email("이메일 형식을 확인해 주세요."),
  password: z
    .string()
    .min(8, "비밀번호는 8자 이상이어야 해요.")
    .max(72, "비밀번호는 72자 이하여야 해요.")
    .regex(/[A-Za-z]/, "비밀번호에 영문자를 포함해 주세요.")
    .regex(/[0-9]/, "비밀번호에 숫자를 포함해 주세요."),
});

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email("이메일 형식을 확인해 주세요."),
  password: z.string().min(1, "비밀번호를 입력해 주세요."),
});

export const coupleSchema = z.object({
  name: z.string().trim().max(40, "이름은 40자 이하로 입력해 주세요.").optional(),
  anniversaryOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "날짜 형식을 확인해 주세요.")
    .optional()
    .or(z.literal("")),
});

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  message?: string;
};

export function fieldErrorsOf(err: z.ZodError) {
  return z.flattenError(err).fieldErrors as Record<string, string[] | undefined>;
}
