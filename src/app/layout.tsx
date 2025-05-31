import type { Metadata } from 'next';
import { Inter } from 'next/font/google'; // Use Inter from Google Fonts
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { Toaster } from '@/components/ui/toaster';
import React from 'react';
import { Providers } from './providers'; // Import the new Providers component

// Instantiate Inter font with subsets and a CSS variable
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans', // Use --font-sans for compatibility with Tailwind's default sans-serif stack
});


export const metadata: Metadata = {
  title: 'MediMate AI',
  description: 'Your Personal AI Healthcare Assistant',
  // icons: {
  //   icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 1 0 10 10h-2a8 8 0 1 1-8-8V2z"/><path d="M12 12a2 2 0 1 0-4 0v4a2 2 0 0 0 4 0Z"/><path d="M12 12a2 2 0 1 0 4 0v-4a2 2 0 0 0-4 0Z"/><path d="m16 8 4-4"/><path d="m17 17 4 4"/></svg>',
  // },
  icons: {
    icon: '/favicon.ico', // Use a favicon for the icon
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Apply the font variable to the html tag and suppress hydration warning
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="antialiased font-sans"> {/* Use font-sans which maps to --font-sans */}
        <Providers> {/* Wrap children with the new Providers component */}
          <AuthProvider>
            {children}
            <Toaster />
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}
