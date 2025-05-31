
'use client';

import React, { useState, useRef, useEffect, FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/context/AuthContext';
import { Loader2, Send, User, Bot, AlertTriangle, MessagesSquare, MessageCircleHeart } from 'lucide-react'; // Added MessageCircleHeart
import { answerMedicalQuestions, AnswerMedicalQuestionsOutput } from '@/ai/flows/answer-medical-questions';
import {
  doc,
  updateDoc,
  // serverTimestamp, // Keep for potential future use, but not in arrayUnion
  onSnapshot,
  FirestoreError,
  Timestamp,
  arrayUnion, // Import arrayUnion
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatDistanceToNow } from 'date-fns';

interface ChatMessage {
  // id: string; // No longer needed as part of array
  role: 'user' | 'assistant'; // Changed from 'sender'
  content: string; // Changed from 'text'
  timestamp: Timestamp; // Firestore Timestamp
  source?: string; // For AI assistant messages - Now optional
}

interface ChatSession {
  id: string;
  title: string;
  userId: string; // Kept for potential client-side validation, though rules handle primary security
  createdAt: Timestamp;
  messages: ChatMessage[]; // Array of messages
}

export default function ChatPage() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const chatId = params.chatId as string;

  const [input, setInput] = useState('');
  const [chatSession, setChatSession] = useState<ChatSession | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Fetch chat session details and messages from /users/{userId}/chats/{chatId}
  useEffect(() => {
    if (!user || !chatId) {
      setIsLoadingSession(false);
      setChatSession(null);
      return;
    }

     // Check if db is initialized
    if (!db) {
        console.error("Firestore instance (db) is not available.");
        setError("Database connection failed. Cannot load chat.");
        setIsLoadingSession(false);
        setChatSession(null);
        return;
    }

    setIsLoadingSession(true);
    setError(null);
    // Reference the chat document in the new location
    const chatDocRef = doc(db, 'users', user.uid, 'chats', chatId);

    console.log(`Setting up listener for chat: /users/${user.uid}/chats/${chatId}`);

    const unsubscribe = onSnapshot(chatDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const sessionData = { id: docSnap.id, ...docSnap.data() } as ChatSession;
        // Basic client-side validation (optional, rules are primary)
        // if (sessionData.userId !== user.uid) { ... }
        console.log(`Received chat data for ${chatId}:`, sessionData.title, `${sessionData.messages?.length || 0} messages`);
        setChatSession(sessionData);
        setError(null); // Clear previous errors
      } else {
        console.error("Chat session not found:", chatId);
        setError("Chat not found.");
        setChatSession(null);
        router.push('/home'); // Redirect if chat doesn't exist
      }
      setIsLoadingSession(false);
    }, (err: FirestoreError) => {
      console.error("Error fetching chat session:", err);
       if (err.code === 'permission-denied') {
           setError("Access denied: Check Firestore rules.");
       } else if (err.code === 'unauthenticated') {
            setError("Not authenticated. Please log in again.");
            router.push('/login'); // Redirect to login if unauthenticated
       } else if (err.code === 'failed-precondition' && err.message.includes('index')) {
           setError("Database error: Missing index. Check Firestore console.");
       }
       else {
          setError("Failed to load chat details. Please try refreshing.");
       }
      setIsLoadingSession(false);
    });

    return () => {
        console.log(`Cleaning up listener for chat: ${chatId}`);
        unsubscribe();
    };
  }, [user, chatId, router]); // Add router to dependencies


  // Scroll to bottom when messages update (derived from chatSession)
  useEffect(() => {
    scrollToBottom();
  }, [chatSession?.messages]); // Depend on messages array within session


  const handleSendMessage = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isSending || !user || !chatId || !chatSession) return; // Ensure chatSession exists

    // Check if db is initialized before attempting to send
    if (!db) {
        console.error("Firestore instance (db) is not available.");
        setError("Database connection failed. Cannot send message.");
        return;
    }

    const userMessageContent = input;
    const userMessageData: Omit<ChatMessage, 'timestamp'> = { // Use Omit as timestamp will be added
      role: 'user',
      content: userMessageContent,
    };
    // Use client-side timestamp for optimistic update AND for arrayUnion
    const clientTimestamp = Timestamp.now();
    const userMessageWithClientTimestamp: ChatMessage = {
        ...userMessageData,
        timestamp: clientTimestamp
    }

    setInput('');
    setIsSending(true);
    setError(null);

     // Optimistic UI update (optional but improves perceived performance)
     setChatSession(prev => prev ? { ...prev, messages: [...prev.messages, userMessageWithClientTimestamp] } : null);


    try {
      // Reference the specific chat document
      const chatDocRef = doc(db, 'users', user.uid, 'chats', chatId);

      // Check if this is the first user message to set the title
      // Ensure chatSession and messages exist before filtering
      const isFirstUserMessage = chatSession?.messages?.filter(m => m.role === 'user').length === 0;

      let updateData: { messages: any; title?: string } = { // Use 'any' for arrayUnion or specific type
          messages: arrayUnion({ // Use arrayUnion to append the message
            ...userMessageData,
            timestamp: clientTimestamp, // Use client timestamp for arrayUnion
          })
      };

      // Update title only if it's the first user message and the title is the default 'New Chat'
      if (isFirstUserMessage && chatSession?.title === 'New Chat') {
           // Auto-generate title from the first message (e.g., first 30 chars)
            const autoTitle = userMessageContent.substring(0, 30) + (userMessageContent.length > 30 ? '...' : '');
            updateData.title = autoTitle;
            console.log(`Setting chat title for ${chatId} to: ${autoTitle}`);
      }

      // Append user message to the messages array in Firestore & potentially update title
      await updateDoc(chatDocRef, updateData);
      console.log(`User message added to chat ${chatId}. Title update attempted: ${!!updateData.title}`);


      // Call AI flow
      const aiResponse: AnswerMedicalQuestionsOutput = await answerMedicalQuestions({ question: userMessageContent });

      const aiMessageData: Omit<ChatMessage, 'timestamp'> = {
        role: 'assistant',
        content: aiResponse.answer,
        // Conditionally add source only if it exists in the response
        ...(aiResponse.source && { source: aiResponse.source }),
      };
      const aiClientTimestamp = Timestamp.now(); // New client timestamp for AI msg

      // Append AI message to the messages array in Firestore
      await updateDoc(chatDocRef, {
          messages: arrayUnion({
            ...aiMessageData,
            timestamp: aiClientTimestamp, // Use client timestamp for arrayUnion
          })
      });
      console.log(`AI response added to chat ${chatId}`);

      // Firestore listener will update the state, removing the need for manual state update here
      // The optimistic update already handled the UI part.

    } catch (err) {
      console.error('Error sending message or getting AI response:', err);
      let errorMessage = 'Sorry, something went wrong. Please try again.';
       if (err instanceof Error && (err as FirestoreError).code === 'permission-denied') {
         errorMessage = "Access denied: Check Firestore rules.";
      } else if (err instanceof Error && (err as FirestoreError).code === 'failed-precondition') {
           errorMessage = "Database error: Check Firestore structure or indexes.";
       } else if (err instanceof Error && (err as FirestoreError).code === 'unauthenticated') {
          errorMessage = "Authentication expired. Please log in again.";
          // Optionally redirect to login
          // router.push('/login');
       } else if (err instanceof Error && err.message.includes('invalid data') && err.message.includes('Timestamp')) {
           // Updated check to be less specific about serverTimestamp
           errorMessage = "Failed to save message: Timestamp error. Please try again.";
           console.error("Timestamp error detected:", err);
       } else if (err instanceof Error && err.message.includes('invalid data')) {
           // Catch other invalid data errors
           errorMessage = "Failed to save message: Invalid data format.";
           console.error("Invalid data passed to Firestore:", err);
       }
      setError(errorMessage);

      // Revert optimistic update on error
       setChatSession(prev => prev ? { ...prev, messages: prev.messages.slice(0, -1) } : null);

       // Add error UI message (optional, displayed below input)

    } finally {
      setIsSending(false);
      setTimeout(scrollToBottom, 100); // Ensure scroll after potential error message or response
    }
  };

  const getInitials = (name: string | null | undefined): string => {
     if (!name) return '?'; // Return '?' if name is null/undefined
     const names = name.trim().split(' ');
     if (names.length === 1 && names[0] === '') return '?'; // Handle empty string case
     if (names.length === 1) return names[0][0].toUpperCase();
     return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
   };


  // Loading state for session
  if (isLoadingSession) {
    return (
       <div className="flex flex-col items-center justify-center h-full max-h-[calc(100vh-theme(spacing.14)-2*theme(spacing.4))] md:max-h-[calc(100vh-2*theme(spacing.4))] lg:max-h-[calc(100vh-2*theme(spacing.8))] bg-secondary rounded-lg shadow-inner overflow-hidden p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
        <p className="text-muted-foreground">Loading chat...</p>
        {error && <p className="text-destructive mt-2">{error}</p>}
       </div>
    );
  }

   // Handle case where chat session is null after loading (e.g., not found or access denied)
   if (!chatSession && !isLoadingSession) {
        return (
            <div className="flex flex-col items-center justify-center h-full max-h-[calc(100vh-theme(spacing.14)-2*theme(spacing.4))] md:max-h-[calc(100vh-2*theme(spacing.4))] lg:max-h-[calc(100vh-2*theme(spacing.8))] bg-secondary rounded-lg shadow-inner overflow-hidden p-4">
                <AlertTriangle className="h-10 w-10 text-destructive mb-4" />
                <p className="text-destructive text-lg">{error || "Chat not available."}</p>
                <Button onClick={() => router.push('/home')} className="mt-4">Go Home</Button>
            </div>
        );
    }


  return (
     <div className="flex flex-col h-full max-h-[calc(100vh-theme(spacing.14)-2*theme(spacing.4))] md:max-h-[calc(100vh-2*theme(spacing.4))] lg:max-h-[calc(100vh-2*theme(spacing.8))] bg-secondary rounded-lg shadow-inner overflow-hidden">
        {/* Optional Header showing chat title */}
       <CardHeader className="p-3 border-b bg-background flex flex-row items-center">
           <MessagesSquare className="h-5 w-5 mr-2 text-primary"/>
           <CardTitle className="text-lg font-medium truncate">{chatSession?.title || 'Chat'}</CardTitle>
        </CardHeader>

        <ScrollArea className="flex-1 p-4">
           <div className="space-y-4 pb-4">
              {/* Display personalized greeting if no messages exist */}
             {chatSession && chatSession.messages.length === 0 && !isSending && user && (
                 <div className="flex flex-col items-center justify-center text-center text-muted-foreground py-10">
                     <MessageCircleHeart className="h-12 w-12 text-primary mb-4" />
                     <p className="text-lg">hey {user.displayName || 'User'}! let’s chat!</p> {/* Updated Line */}
                     <p className="text-md">What’s in your mind? 💬✨</p>
                 </div>
             )}
             {/* Render messages from chatSession.messages */}
             {chatSession && chatSession.messages.map((message, index) => ( // Use index as key for simplicity if no stable ID
               <div
                 key={`${message.timestamp?.seconds}-${index}`} // Combine timestamp seconds and index for a more unique key
                 className={`flex items-start gap-3 ${
                   message.role === 'user' ? 'justify-end' : ''
                 }`}
               >
                 {message.role === 'assistant' && (
                    <Avatar className="h-8 w-8 border border-primary/20 flex-shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        <Bot size={18}/>
                      </AvatarFallback>
                    </Avatar>
                 )}
                 <div
                   className={`rounded-lg p-3 max-w-[75%] shadow-md ${
                     message.role === 'user'
                       ? 'bg-primary text-primary-foreground'
                       : 'bg-card text-card-foreground border' // Add border to AI messages
                   }`}
                 >
                   <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                   {/* Conditionally render source only if it exists */}
                   {message.source && message.role === 'assistant' && (
                     <p className="text-xs text-muted-foreground mt-2 pt-1 border-t border-border/50">
                       Source: {message.source}
                     </p>
                   )}
                    <p className={`text-xs mt-1 text-right ${message.role === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                      {/* Format timestamp */}
                      {message.timestamp?.toDate ? formatDistanceToNow(message.timestamp.toDate(), { addSuffix: true }) : 'Sending...'}
                    </p>
                 </div>
                  {message.role === 'user' && user && (
                   <Avatar className="h-8 w-8 flex-shrink-0">
                     <AvatarImage src={user.photoURL || undefined} alt={user.displayName || 'User'} />
                     <AvatarFallback className="bg-accent text-accent-foreground">
                        {getInitials(user.displayName)}
                     </AvatarFallback>
                   </Avatar>
                 )}
               </div>
             ))}
             {isSending && ( // Show AI thinking indicator while waiting for response
                 <div className="flex items-start gap-3 mt-4">
                     <Avatar className="h-8 w-8 border border-primary/20 flex-shrink-0">
                         <AvatarFallback className="bg-primary/10 text-primary">
                             <Bot size={18}/>
                         </AvatarFallback>
                     </Avatar>
                     <div className="rounded-lg p-3 bg-card text-card-foreground shadow-md border">
                         <Loader2 className="h-5 w-5 animate-spin text-primary" />
                     </div>
                 </div>
             )}
             <div ref={messagesEndRef} /> {/* Element to scroll to */}
           </div>
         </ScrollArea>

         <CardFooter className="p-4 border-t bg-background">
            {error && !isSending && ( // Display error message prominently above input
                <div className="w-full mb-2 flex justify-center">
                 <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-2 rounded-md border border-destructive/30 max-w-md">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                   <p>{error}</p>
                 </div>
                </div>
            )}
           <form onSubmit={handleSendMessage} className="flex w-full items-center gap-2">
             <Input
               type="text"
               placeholder="Ask MediMate anything..."
               value={input}
               onChange={(e) => setInput(e.target.value)}
               className="flex-1"
               disabled={isSending || isLoadingSession || !chatSession} // Disable while sending, loading, or if session is invalid
               aria-label="Chat input"
             />
             <Button type="submit" size="icon" disabled={isSending || !input.trim() || isLoadingSession || !chatSession}>
               {isSending ? (
                 <Loader2 className="h-4 w-4 animate-spin" />
               ) : (
                 <Send className="h-4 w-4" />
               )}
               <span className="sr-only">Send message</span>
             </Button>
           </form>
         </CardFooter>
     </div>
  );
}

    