'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

// This page is no longer needed as history is integrated into the sidebar.
// Redirect users to the home page.
export default function HistoryRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    console.log("Redirecting from /history to /home");
    router.replace('/home');
  }, [router]);

  return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
      <p className="text-muted-foreground">Redirecting...</p>
    </div>
  );
}
