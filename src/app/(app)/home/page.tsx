'use client';

import React from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { AppLogo } from '@/components/ui/app-logo'; // Import the shared logo component

// This component now *always* renders the welcome/placeholder content.
// The actual chat interface or settings page is rendered by the layout based on the route.
export default function HomePage() {
   const { user } = useAuth();

  return (
    <div className="flex flex-col items-center justify-center h-full p-4 md:p-6 lg:p-8 text-center bg-secondary rounded-lg shadow-inner">
       <AppLogo width={100} height={100} /> {/* Use imported logo */}
        <h1 className="mt-6 text-3xl font-semibold text-foreground">
            Welcome to MediMate AI{user?.displayName ? `, ${user.displayName}!` : '!'}
        </h1>
        <p className="mt-2 text-lg text-muted-foreground max-w-md">
            Your personal AI healthcare assistant.
        </p>
        <p className="mt-6 text-md text-muted-foreground flex items-center justify-center gap-2">
           <MessageSquarePlus className="h-5 w-5 text-primary" />
            Select a chat from the sidebar or start a new one to begin.
        </p>
    </div>
  );
}
