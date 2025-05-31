'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuth } from '@/context/AuthContext';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2, UserPlus, CheckCircle, MailWarning } from 'lucide-react'; // Added MailWarning
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { SignUpFormData } from '@/types/auth';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  username: z.string().min(3, { message: 'Username must be at least 3 characters.' }).regex(/^[a-zA-Z0-9_]+$/, { message: 'Username can only contain letters, numbers, and underscores.' }),
  email: z.string().email({ message: 'Invalid email address.' }),
  mobile: z.string().optional().refine(val => !val || /^\+?[1-9]\d{1,14}$/.test(val), { // E.164 format validation (optional)
    message: 'Invalid mobile number format (e.g., +1234567890).',
  }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
});


export default function SignUpPage() {
  const { user, loading, signUpWithEmail } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signupSuccess, setSignupSuccess] = useState(false); // State for success message
  const { toast } = useToast(); // Initialize toast

  const form = useForm<SignUpFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      username: '',
      email: '',
      mobile: '',
      password: '',
    },
  });

  useEffect(() => {
    // Redirect if user is already logged in and loading is complete AND verified
    if (!loading && user && user.emailVerified) {
      router.replace('/home');
    }
     // If user exists but not verified, they stay on auth pages or get prompted in AppLayout
  }, [user, loading, pathname, router]);

  const onSubmit = async (values: SignUpFormData) => {
    setIsSigningUp(true);
    setError(null);
    setSignupSuccess(false);
    try {
      await signUpWithEmail(values);
      // Show success toast
      toast({
        title: 'Account Created Successfully!',
        description: 'Please check your email to verify your account before logging in.',
        duration: 7000, // Keep toast longer
      });
       setSignupSuccess(true); // Show success message on page
       form.reset(); // Clear the form on successful signup
       // Do NOT automatically redirect. User needs to verify email.
       // The success message informs them to check email.
       // They can then navigate to the login page manually or use a provided link.
    } catch (err: unknown) {
      console.error('Sign-Up Error:', err);
      console.log(err)
       setError(err instanceof Error ? err.message : 'Failed to sign up. Please try again.');
       setIsSigningUp(false); // Set signing up to false only on error
    }
    // No finally block needed here for setIsSigningUp(false) on success, as we show success message.
  };

   // Show loading spinner while checking auth state or if user is already logged in (before redirect)
   if (loading || (!loading && user && user.emailVerified)) { // Check verification
    return (
      <div className="flex items-center justify-center min-h-screen bg-secondary">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }


  // Render signup form only if not loading and user is not verified or doesn't exist
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background to-accent p-4"> {/* Updated background */}
      <Card className="w-full max-w-lg shadow-xl rounded-lg bg-card text-card-foreground"> {/* Use card colors */}
        <CardHeader className="text-center">
           <div className="flex justify-center mb-4">
             {/* Placeholder Logo */}
             <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a10 10 0 1 0 10 10h-2a8 8 0 1 1-8-8V2z"/>
                <path d="M12 12a2 2 0 1 0-4 0v4a2 2 0 0 0 4 0Z"/>
                <path d="M12 12a2 2 0 1 0 4 0v-4a2 2 0 0 0-4 0Z"/>
                <path d="m16 8 4-4"/>
                <path d="m17 17 4 4"/>
             </svg>
           </div>
          <CardTitle className="text-3xl font-bold text-foreground">Create Account</CardTitle>
          <CardDescription className="text-muted-foreground">Join MediMate AI today!</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
           {error && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive p-3 rounded-md text-sm text-center">
              {error}
            </div>
          )}
           {signupSuccess && ( // Show success message with icon
             <div className="bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 text-green-800 dark:text-green-200 p-3 rounded-md text-sm text-center flex items-center justify-center gap-2">
               <MailWarning className="h-5 w-5" />
               <span>Account created! Please check your email ({form.getValues('email')}) for a verification link.</span>
             </div>
           )}
          {!signupSuccess && ( // Only show form if signup is not successful yet
             <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} disabled={isSigningUp} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input placeholder="john_doe" {...field} disabled={isSigningUp} />
                      </FormControl>
                       <p className="text-xs text-muted-foreground">Letters, numbers, and underscores only.</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="you@example.com" {...field} disabled={isSigningUp} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="mobile"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mobile Number (Optional)</FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder="+1234567890" {...field} disabled={isSigningUp} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} disabled={isSigningUp} />
                      </FormControl>
                       <p className="text-xs text-muted-foreground">Must be at least 6 characters long.</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <Button type="submit" disabled={isSigningUp} className="w-full py-3 text-lg rounded-md shadow-md hover:shadow-lg flex items-center justify-center gap-2">
                   {isSigningUp ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserPlus className="h-5 w-5" />}
                   {isSigningUp ? 'Creating Account...' : 'Sign Up'}
                 </Button>
              </form>
            </Form>
           )}
        </CardContent>
        <CardFooter className="flex flex-col items-center space-y-2 pt-4">
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className={`font-medium text-primary hover:underline ${signupSuccess ? 'opacity-70' : ''}`}>
                Sign In
              </Link>
            </p>
             <p className="text-center text-xs text-muted-foreground">
               By signing up, you agree to our Terms of Service and Privacy Policy.
            </p>
        </CardFooter>
      </Card>
    </div>
  );
}
