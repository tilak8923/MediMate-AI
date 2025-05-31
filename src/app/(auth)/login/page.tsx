
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuth } from '@/context/AuthContext';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2, LogIn } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { SignInFormData } from '@/types/auth';

// Simple inline SVG for Google icon
const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="24px" height="24px">
    <path fill="#EA4335" d="M24 9.5c3.46 0 6.47 1.19 8.85 3.43l6.75-6.75C35.37 2.13 30.11 0 24 0 14.5 0 6.56 5.39 2.62 12.96l8.04 6.24C12.44 13.81 17.7 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.25 24c0-1.66-.14-3.27-.41-4.83H24v9.18h12.5c-.54 2.98-2.19 5.48-4.66 7.18l7.3 5.65c4.29-3.96 6.76-9.64 6.76-16.18z"/>
    <path fill="#FBBC05" d="M10.66 19.2A14.46 14.46 0 0 0 9.5 24a14.46 14.46 0 0 0 1.16 4.8l-8.04 6.24C1.07 30.74 0 27.54 0 24c0-3.54 1.07-6.74 2.62-9.76l8.04 6.96z"/>
    <path fill="#34A853" d="M24 48c6.11 0 11.37-2.02 15.19-5.46l-7.3-5.65c-2.05 1.38-4.68 2.2-7.89 2.2-6.3 0-11.56-4.31-13.4-10.14l-8.04 6.24C6.56 42.61 14.5 48 24 48z"/>
    <path fill="none" d="M0 0h48v48H0z"/>
  </svg>
);

// Updated schema to accept email or username in the same field
const formSchema = z.object({
  emailOrUsername: z.string().min(1, { message: 'Email or Username is required.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
});

// Update the form data type to reflect the change
type SignInFormDataType = z.infer<typeof formSchema>;


export default function LoginPage() {
  const { user, loading, signInWithGoogle, signInWithEmail } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

   const form = useForm<SignInFormDataType>({ // Use updated type
    resolver: zodResolver(formSchema),
    defaultValues: {
      emailOrUsername: '', // Changed field name
      password: '',
    },
  });


  useEffect(() => {
    // Redirect to home page if user is logged in and loading is finished
    if (!loading && user && user.emailVerified) { // Check for verification too
      router.replace('/home');
    }
     // If user exists but is not verified, AppLayout will handle the prompt.
     // No need to redirect here specifically for non-verified users.
  }, [user, loading, pathname, router]);

  const handleGoogleSignIn = async () => {
    setIsGoogleSigningIn(true);
    setError(null);
    try {
      await signInWithGoogle();
      // Redirect is handled by the useEffect hook which watches `user` state.
    } catch (err: unknown) {
      console.error('Google Sign-In Error:', err);
      const message = err instanceof Error ? err.message : 'Failed to sign in with Google. Please try again.';
      // Check for common user-cancel/popup errors and provide clearer messages
      if (message.includes('auth/popup-closed-by-user') || message.includes('auth/cancelled-popup-request')) {
        setError('Sign-in popup closed before completion.');
      } else if (message.includes('auth/popup-blocked')) {
         setError('Popup blocked. Please allow popups for this site and try again.');
      }
      else {
         setError(message);
      }
       setIsGoogleSigningIn(false); // Only set false on error, success relies on useEffect redirect
    }
     // No finally block needed here - success leads to redirect via useEffect, error is handled in catch.
  };

   const onSubmit = async (values: SignInFormDataType) => { // Use updated type
    setIsSigningIn(true);
    setError(null);
    try {
        // Pass the emailOrUsername value to the context function
        // The context function will handle whether it's an email or username
      await signInWithEmail({ email: values.emailOrUsername, password: values.password });
      // Redirect is handled by the useEffect hook after successful sign-in and user state update.
    } catch (err: unknown) {
      console.error('Email/Username Sign-In Error:', err);
       // Set error state based on the error thrown by AuthContext
       setError(err instanceof Error ? err.message : 'Failed to sign in. Please try again.');
       setIsSigningIn(false); // Set false only on error
    }
     // No finally block needed here.
  };

  // Show loading spinner while checking auth state or if user is logged in (before redirect)
  if (loading || (!loading && user && user.emailVerified)) { // Check verification here too
    return (
      <div className="flex items-center justify-center min-h-screen bg-secondary">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // Render login form only if not loading and user is not verified or doesn't exist
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background to-accent p-4"> {/* Updated background */}
      <Card className="w-full max-w-md shadow-xl rounded-lg bg-card text-card-foreground"> {/* Use card colors */}
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
          <CardTitle className="text-3xl font-bold text-foreground">Welcome Back!</CardTitle>
          <CardDescription className="text-muted-foreground">Sign in to MediMate AI</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && ( // Conditionally display the error message
            <div className="bg-destructive/10 border border-destructive/30 text-destructive p-3 rounded-md text-sm text-center">
              {error}
            </div>
          )}
           <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="emailOrUsername" // Updated field name
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email or Username</FormLabel>
                    <FormControl>
                      <Input placeholder="you@example.com or your_username" {...field} />
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
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <Button type="submit" disabled={isSigningIn || isGoogleSigningIn} className="w-full py-3 text-lg rounded-md shadow-md hover:shadow-lg flex items-center justify-center gap-2">
                 {isSigningIn ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
                 {isSigningIn ? 'Signing In...' : 'Sign In'}
               </Button>
            </form>
          </Form>

           <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" /> {/* Use border color */}
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground"> {/* Use card bg */}
                Or continue with
              </span>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={handleGoogleSignIn}
            disabled={isSigningIn || isGoogleSigningIn}
            className="w-full py-3 text-lg rounded-md transition-colors duration-200 ease-in-out shadow-sm hover:shadow flex items-center justify-center gap-2 border-border"
          >
            {isGoogleSigningIn ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            {isGoogleSigningIn ? 'Signing In...' : 'Google'}
          </Button>

        </CardContent>
         <CardFooter className="flex flex-col items-center space-y-2 pt-4">
            <p className="text-sm text-muted-foreground">
              Don't have an account?{' '}
              <Link href="/signup" className="font-medium text-primary hover:underline">
                Sign Up
              </Link>
            </p>
             <p className="text-center text-xs text-muted-foreground">
              By signing in, you agree to our Terms of Service and Privacy Policy.
            </p>
        </CardFooter>
      </Card>
    </div>
  );
}
