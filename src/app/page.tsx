'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

export default function RootRedirectPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        if (user.emailVerified) {
          // User logged in and verified -> Redirect to main app home
          console.log("Root page: User verified, redirecting to /home");
          router.replace('/home');
        } else {
          // User logged in but NOT verified -> Redirect to login (AppLayout will handle verification prompt if they try protected routes)
          console.log("Root page: User not verified, redirecting to /login");
          router.replace('/login');
        }
      } else {
        // User not logged in -> Redirect to login
        console.log("Root page: User not logged in, redirecting to /login");
        router.replace('/login');
      }
    }
  }, [user, loading, router]);

  // Show loading state while checking auth
  return (
    <div className="flex items-center justify-center min-h-screen bg-secondary">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <p className="ml-4 text-lg text-foreground">Loading MediMate AI...</p>
    </div>
  );
}
