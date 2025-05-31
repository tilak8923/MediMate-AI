'use client';
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarInset,
  SidebarGroup,
  SidebarGroupLabel,
  useSidebar,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { LogOut, MessageSquare, History, Loader2, MailWarning, RefreshCw, Plus, Trash2, Edit, CheckCircle, Settings, User as UserIcon } from 'lucide-react';
import Link from 'next/link';
import { auth, db } from '@/lib/firebase'; // Import auth and db
import { sendEmailVerification } from 'firebase/auth';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, deleteDoc, updateDoc, where, writeBatch, getDocs, FirestoreError, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { ThemeToggle } from '@/components/theme-toggle';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose
} from "@/components/ui/dialog"
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { AppLogo } from '@/components/ui/app-logo';


interface ChatSession {
    id: string;
    title: string;
    createdAt: Timestamp;
    userId: string;
}


export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOutUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [isResending, setIsResending] = useState(false);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [errorChats, setErrorChats] = useState<string | null>(null);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<ChatSession | null>(null);
  const [isDeletingChat, setIsDeletingChat] = useState(false);

  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [chatToRename, setChatToRename] = useState<ChatSession | null>(null);
  const [newChatTitle, setNewChatTitle] = useState('');
  const [isRenamingChat, setIsRenamingChat] = useState(false);

  // Determine active chat ID from the URL path
  const activeChatId = useMemo(() => {
    if (pathname.startsWith('/chat/')) {
      return pathname.split('/')[2];
    }
    return null;
  }, [pathname]);


  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  // Fetch Chat Sessions from the new location: /users/{userId}/chats
  useEffect(() => {
    if (!user) {
      setLoadingChats(false);
      setChatSessions([]); // Clear sessions if no user
      setErrorChats(null);
      return;
    }

    setLoadingChats(true);
    setErrorChats(null);
    console.log(`Fetching chats for user: ${user.uid} from /users/${user.uid}/chats`);
    if (!db) {
        console.error("Firestore instance (db) is not available for fetching chats.");
        setErrorChats("Failed to connect to the database.");
        setLoadingChats(false);
        return;
    }
    const userChatsRef = collection(db, 'users', user.uid, 'chats');
    // Order by creation date (descending for newest first in sidebar)
    const q = query(userChatsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const sessions: ChatSession[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        sessions.push({
            id: doc.id,
            title: data.title || 'Untitled Chat',
            createdAt: data.createdAt,
            userId: user.uid,
        } as ChatSession);
      });
      console.log(`Fetched ${sessions.length} chat sessions from new structure.`);
      setChatSessions(sessions);
      setLoadingChats(false);
    }, (err: FirestoreError) => {
      console.error("Error fetching chat sessions from new structure:", err);
       if (err.code === 'permission-denied') {
          setErrorChats("Access denied: Check Firestore rules.");
       } else if (err.code === 'unauthenticated') {
           setErrorChats("Not authenticated. Please log in.");
       } else if (err.code === 'failed-precondition' && err.message.includes('index')) {
          setErrorChats("Database error: Missing index. Check Firestore console.");
       } else if (err.code === 'unavailable') {
           setErrorChats("Database unavailable. Check connection.");
       } else {
         setErrorChats(`Failed to load chat history (${err.code}).`);
       }
      setLoadingChats(false);
    });

    return () => unsubscribe();
  }, [user]);


  const handleCreateNewChat = async () => {
    if (!user || isCreatingChat) return;

    setIsCreatingChat(true);
    try {
      if (!db) {
        throw new Error("Firestore instance (db) is not available.");
      }
      const userChatsRef = collection(db, 'users', user.uid, 'chats');
      const newChatRef = await addDoc(userChatsRef, {
        title: `New Chat`,
        createdAt: serverTimestamp(),
        messages: [],
      });

      router.push(`/chat/${newChatRef.id}`);
       toast({
        title: "New Chat Created",
        description: "Start typing your first message.",
      });
    } catch (error) {
      console.error("Error creating new chat:", error);
       toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create new chat.",
      });
       if (error instanceof Error && (error as FirestoreError).code === 'permission-denied') {
          setErrorChats("Access denied: Check Firestore rules.");
       } else if (error instanceof Error && (error as FirestoreError).code === 'failed-precondition') {
          setErrorChats("Database error: Check Firestore setup/indexes.");
       }
    } finally {
      setIsCreatingChat(false);
    }
  };

 const handleDeleteChat = async () => {
    if (!chatToDelete || !user || isDeletingChat) return;

    setIsDeletingChat(true);
    const chatId = chatToDelete.id;

    if (!db) {
        console.error("Firestore instance (db) is not available for deleting chat.");
        toast({
            variant: "destructive",
            title: "Error",
            description: "Database connection failed.",
        });
        setIsDeletingChat(false);
        return;
    }

    const chatDocRef = doc(db, 'users', user.uid, 'chats', chatId);

    try {
      await deleteDoc(chatDocRef);
      console.log(`Deleted chat document ${chatId} from /users/${user.uid}/chats`);

      toast({
        title: "Chat Deleted",
        description: `"${chatToDelete.title}" has been removed.`,
      });

      if (activeChatId === chatId) {
        console.log("Active chat deleted, navigating to /home");
        router.push('/home');
      } else {
         console.log("Deleted chat was not active, staying on current page:", pathname);
      }

    } catch (error) {
      console.error("Error deleting chat:", error);
       let errorMessage = "Failed to delete chat.";
        if (error instanceof Error && (error as FirestoreError).code === 'permission-denied') {
            errorMessage = "Access denied: Check Firestore rules.";
        } else if (error instanceof Error && (error as FirestoreError).code === 'failed-precondition') {
           errorMessage = "Database error: Check Firestore setup.";
        }
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    } finally {
      setIsDeletingChat(false);
      setChatToDelete(null);
    }
  };

  const openRenameDialog = (chat: ChatSession) => {
    setChatToRename(chat);
    setNewChatTitle(chat.title);
    setRenameDialogOpen(true);
  };

  const handleRenameChat = async (event: React.FormEvent) => {
     event.preventDefault();
    if (!chatToRename || !newChatTitle.trim() || isRenamingChat) return;

    setIsRenamingChat(true);
    if (!db || !user) {
        console.error("Firestore instance (db) or user is not available for renaming chat.");
         toast({
            variant: "destructive",
            title: "Error",
            description: "Database connection or authentication failed.",
        });
        setIsRenamingChat(false);
        return;
    }
    const chatDocRef = doc(db, 'users', user.uid, 'chats', chatToRename.id);

    try {
      await updateDoc(chatDocRef, {
        title: newChatTitle.trim(),
      });
      toast({
        title: "Chat Renamed",
        description: `Chat renamed to "${newChatTitle.trim()}".`,
      });
      setRenameDialogOpen(false);
    } catch (error) {
      console.error("Error renaming chat:", error);
       let errorMessage = "Failed to rename chat.";
        if (error instanceof Error && (error as FirestoreError).code === 'permission-denied') {
            errorMessage = "Access denied: Check Firestore rules.";
        } else if (error instanceof Error && (error as FirestoreError).code === 'failed-precondition') {
           errorMessage = "Database error: Check Firestore setup.";
        }
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    } finally {
      setIsRenamingChat(false);
    }
  };


   const handleResendVerification = async () => {
    if (!user || !auth?.currentUser) return;
    setIsResending(true);
    try {
      await sendEmailVerification(auth.currentUser);
      toast({
        title: "Verification Email Sent",
        description: "Please check your inbox (and spam folder).",
      });
    } catch (error: any) {
      console.error("Error resending verification email:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to resend verification email: ${error.message}`,
      });
    } finally {
      setIsResending(false);
    }
  };

   const [isEmailVerified, setIsEmailVerified] = useState(user?.emailVerified ?? false);

    useEffect(() => {
        setIsEmailVerified(user?.emailVerified ?? false);
    }, [user?.emailVerified]);

    const checkVerificationStatus = async () => {
        if (!auth?.currentUser) return;
        setIsResending(true);
        try {
            await auth.currentUser.reload();
            const freshUser = auth.currentUser;
            if (freshUser?.emailVerified) {
                setIsEmailVerified(true);
                toast({ title: "Email Verified!", description: "Welcome!" });
                if (!pathname.startsWith('/chat') && pathname !== '/home') {
                    router.push('/home');
                }

            } else {
                toast({ variant: "destructive", title: "Email Not Verified", description: "Please check your email and click the verification link." });
            }
        } catch (error: any) {
            console.error("Error checking verification status:", error);
            toast({ variant: "destructive", title: "Error", description: `Failed to check verification status: ${error.message}` });
        } finally {
            setIsResending(false);
        }
    };

  // Remove the explicit loading check here. AuthContext handles initial loading.
  // if (loading) { ... }

   if (!user) {
     return (
      <div className="flex items-center justify-center min-h-screen bg-secondary">
        <p className="text-muted-foreground">Redirecting to login...</p>
         <Loader2 className="h-6 w-6 ml-2 animate-spin text-primary" />
      </div>
    );
  }

  if (user && !isEmailVerified) {
     return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-secondary p-6 text-center">
        <MailWarning className="h-16 w-16 text-primary mb-4" />
        <h2 className="text-2xl font-semibold mb-2 text-foreground">Verify Your Email</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          A verification email has been sent to <strong>{user.email}</strong>. Please check your inbox (and spam folder) and click the link to activate your account.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
           <Button onClick={handleResendVerification} disabled={isResending}>
             {isResending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
             Resend Email
           </Button>
           <Button variant="outline" onClick={checkVerificationStatus} disabled={isResending}>
             <CheckCircle className="mr-2 h-4 w-4" />
              I've Verified / Check Again
           </Button>
           <Button size="sm" onClick={() => { auth?.signOut(); router.replace('/login'); }}>
             <LogOut className="mr-2 h-4 w-4" />
             Log Out
           </Button>
        </div>
         <p className="text-sm text-muted-foreground mt-4">Click "Check Again" after you've verified your email.</p>
      </div>
    );
  }


  const getInitials = (name: string | null | undefined): string => {
    if (!name) return '?';
    const names = name.trim().split(' ');
    if (names.length === 1 && names[0] === '') return '?';
    if (names.length === 1) return names[0][0].toUpperCase();
    return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
  };

   const sidebarContent = useMemo(() => (
     <>
        <SidebarHeader className="flex items-center justify-between p-2 border-b border-sidebar-border h-14">
            <div className="flex items-center gap-2 flex-grow overflow-hidden pl-1">
                 <span className="group-data-[collapsible=icon]:hidden">
                    <AppLogo width={50} height={50}/>
                 </span>
                 <span className="font-semibold text-lg text-sidebar-foreground truncate group-data-[collapsible=icon]:hidden">
                    MediMate AI
                 </span>
            </div>
        </SidebarHeader>

       <SidebarContent className="p-0 flex-grow">
          <ScrollArea className="h-full">
             <div className="p-2">
                 <SidebarMenu>
                     <SidebarMenuItem className="mb-1">
                         <SidebarMenuButton
                             onClick={handleCreateNewChat}
                             disabled={isCreatingChat}
                             variant="default"
                             size="sm"
                             className="w-full group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:mx-auto"
                             tooltip={{ children: 'New Chat', side: 'right', align: 'center' }}
                         >
                             {isCreatingChat ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                             <span className="ml-2 group-data-[collapsible=icon]:hidden">New Chat</span>
                         </SidebarMenuButton>
                     </SidebarMenuItem>

                    <SidebarMenuItem>
                        <SidebarMenuButton
                            isActive={false}
                            variant={null}
                            size="sm"
                            className="cursor-default hover:bg-transparent text-sidebar-foreground font-semibold pointer-events-none justify-start group-data-[collapsible=icon]:justify-center"
                            tooltip={{ children: 'Chats', side: 'right', align: 'center' }}
                             asChild={false}
                        >
                            <MessageSquare className="shrink-0" />
                            <span className="group-data-[collapsible=icon]:hidden">Chats</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>

                    <SidebarMenu className="group-data-[collapsible=icon]:hidden ml-4 border-l border-sidebar-border pl-2">
                        <SidebarGroupLabel className="mt-0 pl-2 text-xs text-muted-foreground">Recent Chats</SidebarGroupLabel>
                        {loadingChats && (
                             <div className="px-2 space-y-1">
                                <Skeleton className="h-7 w-full" />
                                <Skeleton className="h-7 w-3/4" />
                                <Skeleton className="h-7 w-1/2" />
                             </div>
                        )}
                        {!loadingChats && errorChats && (
                            <p className="px-2 text-xs text-destructive">{errorChats}</p>
                        )}
                        {!loadingChats && !errorChats && chatSessions.length === 0 && !isCreatingChat && (
                           <p className="px-2 text-xs text-muted-foreground text-center mt-1">
                              Still waiting for your first ‘Hey 👋’ moment
                           </p>
                        )}
                         {!loadingChats && !errorChats && chatSessions.map((chat) => (
                           <SidebarMenuItem key={chat.id}>
                                <div className="relative flex items-center w-full group/menu-item">
                                    <Link href={`/chat/${chat.id}`} passHref legacyBehavior>
                                      <SidebarMenuButton
                                        isActive={activeChatId === chat.id}
                                        variant="default" // Change "ghost" to "default"
                                        size="sm"
                                        className="justify-start flex-grow pr-10 w-full"
                                        tooltip={{ children: chat.title, side: 'right', align: 'center' }}
                                      >
                                        <span className="truncate">{chat.title}</span>
                                      </SidebarMenuButton>
                                    </Link>
                                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center space-x-0 opacity-0 group-hover/menu-item:opacity-100 focus-within:opacity-100 transition-opacity">
                                         <Button
                                            size="icon"
                                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                            onClick={(e) => { e.stopPropagation(); openRenameDialog(chat); }}
                                            aria-label="Rename chat"
                                            title="Rename Chat"
                                        >
                                            <Edit className="h-3 w-3" />
                                        </Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button
                                                    size="icon"
                                                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                                    onClick={(e) => { e.stopPropagation(); setChatToDelete(chat); }}
                                                    aria-label="Delete chat"
                                                    title="Delete Chat"
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </AlertDialogTrigger>
                                        </AlertDialog>
                                    </div>
                                </div>
                           </SidebarMenuItem>
                        ))}
                    </SidebarMenu>

                  </SidebarMenu>
              </div>
            </ScrollArea>
        </SidebarContent>


       <SidebarFooter className="p-2 border-t border-sidebar-border space-y-2">
         <div
            role="button"
            tabIndex={0}
            onClick={() => router.push('/settings')}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') router.push('/settings'); }}
            className="block rounded-md transition-colors hover:bg-sidebar-accent focus:outline-none focus:ring-2 focus:ring-sidebar-ring focus:ring-offset-1 focus:ring-offset-sidebar border border-transparent hover:border-sidebar-border cursor-pointer"
            aria-label="Account Settings"
         >
            <div className="flex items-center gap-3 p-2 group-data-[collapsible=icon]:justify-center">
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarImage src={user?.photoURL || undefined} alt={user?.displayName || 'User'} />
                <AvatarFallback>{getInitials(user?.displayName)}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col overflow-hidden group-data-[collapsible=icon]:hidden">
                <span className="text-sm font-medium text-sidebar-foreground truncate max-w-[120px]">
                  {user?.displayName || 'User'}
                </span>
                <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                  {user?.email}
                </span>
              </div>
            </div>
          </div>


           <div className="flex items-center justify-between group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:gap-2">
                 <Button
                     size="sm"
                     className="w-full justify-start group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex-grow mr-1 group-data-[collapsible=icon]:mr-0"
                     onClick={signOutUser}
                     title="Sign Out"
             >
                 <LogOut className="h-4 w-4" />
                 <span className="ml-2 group-data-[collapsible=icon]:hidden">Sign Out</span>
             </Button>

             <div className="flex-shrink-0 group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
                <ThemeToggle />
             </div>
           </div>

       </SidebarFooter>
     </>
   ), [
     user,
     pathname,
     activeChatId,
     chatSessions,
     loadingChats,
     errorChats,
     isCreatingChat,
     handleCreateNewChat,
     signOutUser,
     getInitials,
     isDeletingChat,
     isRenamingChat,
     openRenameDialog,
     setChatToDelete,
     router,
     handleRenameChat,
     newChatTitle,
     toast,
     handleDeleteChat,
     setRenameDialogOpen,
     renameDialogOpen,
     setNewChatTitle,
     chatToRename,
]);


  return (
    <SidebarProvider defaultOpen>
         <SidebarTrigger className="fixed top-2 left-2 z-20 h-8 w-8 font-bold" />

       <Sidebar collapsible="icon">
         {sidebarContent}
       </Sidebar>

      <SidebarInset className="flex flex-col">
          <header className="sticky top-0 z-10 flex items-center h-14 px-4 border-b bg-background md:hidden">
             <div className="flex items-center gap-2 flex-grow justify-center">
              <AppLogo />
              <span className="font-semibold text-lg">MediMate AI</span>
            </div>
         </header>

         <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
             {children}
         </main>
      </SidebarInset>

       <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
            <DialogContent>
                <DialogHeader>
                <DialogTitle>Rename Chat</DialogTitle>
                <DialogDescription>
                    Enter a new title for the chat "{chatToRename?.title}".
                </DialogDescription>
                </DialogHeader>
                 <form onSubmit={handleRenameChat}>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="new-title" className="text-right">
                            Title
                        </Label>
                        <Input
                            id="new-title"
                            value={newChatTitle}
                            onChange={(e) => setNewChatTitle(e.target.value)}
                            className="col-span-3"
                            disabled={isRenamingChat}
                            required
                            autoFocus
                        />
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="outline" disabled={isRenamingChat}>Cancel</Button>
                         </DialogClose>
                        <Button type="submit" disabled={isRenamingChat || !newChatTitle.trim()}>
                            {isRenamingChat ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Rename
                        </Button>
                    </DialogFooter>
                 </form>
            </DialogContent>
        </Dialog>


       <AlertDialog open={!!chatToDelete} onOpenChange={(open) => !open && setChatToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the chat
                "{chatToDelete?.title}" and all its messages.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeletingChat}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteChat}
                className="bg-destructive hover:bg-destructive/90"
                disabled={isDeletingChat}
              >
                {isDeletingChat ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Yes, delete chat
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

    </SidebarProvider>
  );
}

// This layout component wraps the entire application with authentication, theming, and sidebar functionality.
