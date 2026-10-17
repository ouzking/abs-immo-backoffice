import { z } from 'zod'

/** Politique de mot de passe du projet Supabase (docs backend § 3.1). */
export const passwordSchema = z
  .string()
  .min(10, 'Au moins 10 caractères.')
  .max(72, '72 caractères maximum.')
  .regex(/[a-z]/, 'Au moins une lettre minuscule.')
  .regex(/[A-Z]/, 'Au moins une lettre majuscule.')
  .regex(/[0-9]/, 'Au moins un chiffre.')

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Saisissez votre e-mail.').email('Adresse e-mail invalide.'),
  password: z.string().min(1, 'Saisissez votre mot de passe.'),
})
export type LoginValues = z.infer<typeof loginSchema>

export const forgotSchema = z.object({
  email: z.string().trim().min(1, 'Saisissez votre e-mail.').email('Adresse e-mail invalide.'),
})
export type ForgotValues = z.infer<typeof forgotSchema>

export const newPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Les deux mots de passe ne correspondent pas.' })
export type NewPasswordValues = z.infer<typeof newPasswordSchema>

export const PASSWORD_RULES = [
  { test: (v: string) => v.length >= 10, label: '10 caractères minimum' },
  { test: (v: string) => /[a-z]/.test(v), label: 'Une minuscule' },
  { test: (v: string) => /[A-Z]/.test(v), label: 'Une majuscule' },
  { test: (v: string) => /[0-9]/.test(v), label: 'Un chiffre' },
] as const
