import * as z from 'zod';

// Schema for Sign In form
export const signInSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
});

// Type derived from the Sign In schema
export type SignInFormData = z.infer<typeof signInSchema>;


// Schema for Sign Up form
export const signUpSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  username: z.string().min(3, { message: 'Username must be at least 3 characters.' }).regex(/^[a-zA-Z0-9_]+$/, { message: 'Username can only contain letters, numbers, and underscores.' }),
  email: z.string().email({ message: 'Invalid email address.' }),
  mobile: z.string().optional().refine(val => !val || /^\+?[1-9]\d{1,14}$/.test(val), { // E.164 format validation (optional)
    message: 'Invalid mobile number format (e.g., +1234567890).',
  }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
});

// Type derived from the Sign Up schema
export type SignUpFormData = z.infer<typeof signUpSchema>;