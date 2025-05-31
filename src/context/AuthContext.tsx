
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  Auth,
  User,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  AuthError,
  sendEmailVerification,
} from 'firebase/auth';
import { auth, db, storage } from '@/lib/firebase'; // Ensure firebase config is correctly set up
import { doc, setDoc, getDoc, query, where, collection, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore'; // Added writeBatch
import type { SignUpFormData } from '@/types/auth';
import type { SignInFormData } from '@/types/auth';
import { Loader2 } from 'lucide-react'; // Ensure Loader2 is imported

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (data: SignInFormData) => Promise<void>;
  signUpWithEmail: (data: SignUpFormData) => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if Firebase Auth is initialized
    if (!auth) {
        console.error("Firebase Auth is not initialized. Cannot monitor auth state.");
        setLoading(false);
        return;
    }
    console.log("Setting up Firebase Auth listener...");
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log("onAuthStateChanged triggered. User:", currentUser ? currentUser.uid : 'null', 'Verified:', currentUser?.emailVerified);
       // Force reload user data to get the latest profile info (including photoURL)
       if (currentUser) {
         currentUser.reload().then(() => {
            // Need to get the fresh user object after reload
            const freshUser = auth.currentUser;
            setUser(freshUser);
            setLoading(false);
             if (freshUser) {
                console.log("User is logged in (fresh data):", freshUser.email, "Photo:", freshUser.photoURL, "Verified:", freshUser.emailVerified);
             } else {
                 console.log("User logged out after reload check.");
             }
         }).catch(error => {
             console.error("Error reloading user:", error);
             // Fallback to the potentially stale currentUser if reload fails
             setUser(currentUser);
             setLoading(false);
         });
       } else {
         setUser(null);
         setLoading(false);
         console.log("User is logged out.");
       }
    }, (error) => {
        console.error("Error in onAuthStateChanged listener:", error);
        setUser(null); // Ensure user is null on listener error
        setLoading(false); // Ensure loading stops on listener error
    });

    // Log Firestore status
    if (db) {
        console.log("Firestore instance (db) is available in AuthProvider.");
    } else {
        console.warn("Firestore instance (db) is NOT available in AuthProvider. Database operations will fail.");
    }
     // Log Storage status
     if (storage) {
       console.log("Storage instance (storage) is available in AuthProvider.");
     } else {
       console.warn("Storage instance (storage) is NOT available in AuthProvider. File operations will fail.");
     }


    // Cleanup subscription on unmount
    return () => {
        console.log("Cleaning up Firebase Auth listener.");
        unsubscribe();
    }
  }, []); // Run only once on mount

  const handleAuthError = (error: unknown, defaultMessage: string): string => {
    console.error("Auth Error Details:", error); // Log the full error object
    if (error instanceof Error && 'code' in error) {
      const authError = error as AuthError;
      switch (authError.code) {
        case 'auth/invalid-api-key':
        case 'auth/api-key-not-valid': // Include specific code for invalid key
            return 'Invalid Firebase API Key. Please check your configuration.';
        case 'auth/invalid-email':
          return 'Invalid email format.';
        case 'auth/user-not-found':
        case 'auth/invalid-credential': // Catch newer error code for invalid email/password
        case 'auth/wrong-password': // Keep for older Firebase versions if necessary
          return 'Invalid email/username or password. Please check your details and try again.'; // Updated message
        case 'auth/email-already-in-use':
          return 'This email is already registered.';
        case 'auth/weak-password':
          return 'Password is too weak. Please use at least 6 characters.';
        case 'auth/operation-not-allowed':
          return 'Sign-in method (e.g., Email/Password) is disabled. Check Firebase console.';
        case 'auth/configuration-not-found': // Added this case
            console.error("CRITICAL: Firebase 'auth/configuration-not-found'. This usually means the Email/Password or Google Sign-in provider is NOT ENABLED in your Firebase project console (Authentication -> Sign-in method). Please enable it.");
            return 'Sign-in method configuration missing. Check Firebase console (Authentication -> Sign-in method) and ensure Email/Password provider is enabled.';
        case 'auth/popup-closed-by-user':
          return 'Sign-in popup closed before completion.';
        case 'auth/cancelled-popup-request':
          return 'Sign-in cancelled.';
        case 'auth/popup-blocked':
           return 'Popup blocked by browser. Please allow popups for this site.';
        case 'auth/network-request-failed':
          return 'Network error. Please check your connection and try again.';
        case 'auth/unauthorized-domain':
           console.error("CRITICAL: Firebase 'auth/unauthorized-domain'. Ensure your application's domain (e.g., localhost, your deployed URL) is added to the 'Authorized domains' list in Firebase Console -> Authentication -> Settings.");
           return 'This domain is not authorized for authentication. Check Firebase console settings.';
        default:
           console.warn(`Unhandled Firebase Auth Error Code: ${authError.code}`);
           return `${defaultMessage} (${authError.code})`; // Include code for debugging
      }
    } else if (error instanceof Error) {
        // Handle Firestore specific permission errors if they reach here unexpectedly
        if (error.message.includes('Missing or insufficient permissions')) {
            return 'Database access denied. Check Firestore rules.';
        }
        return error.message; // Return generic error message if no code
    }
    return defaultMessage;
  }


  const signInWithGoogle = async () => {
    if (!auth) throw new Error("Firebase Auth is not initialized.");
    if (!db) console.warn("Firestore is not initialized. User profile creation/update might fail."); // Warning

    setLoading(true); // Start loading indicator
    const provider = new GoogleAuthProvider();
    try {
      console.log("Attempting Google Sign-In...");
      const result = await signInWithPopup(auth, provider);
      console.log("Google Sign-In successful for user:", result.user.uid);
      // User signed in successfully. onAuthStateChanged handles user state update.

      // Optionally check if user exists in Firestore and create/update profile if needed
      if (db) { // Only proceed if db is available
            const userRef = doc(db, "users", result.user.uid);
            const usernameDefault = result.user.email?.split('@')[0] || `user_${result.user.uid.substring(0, 5)}`;
            const usernameRef = doc(db, "usernames", usernameDefault); // Prepare username doc ref

            const batch = writeBatch(db); // Use a batch for potential multiple writes

            const docSnap = await getDoc(userRef);
            if (!docSnap.exists()) {
                console.log("User profile not found in Firestore, creating...");
                 // Check if default username is taken (less likely for Google sign-in, but good practice)
                 let finalUsername = usernameDefault;
                 try {
                    const usernameSnap = await getDoc(usernameRef);
                    if (usernameSnap.exists()) {
                        console.warn(`Default username ${usernameDefault} already taken. Generating unique username.`);
                        finalUsername = `${usernameDefault}_${result.user.uid.substring(0, 4)}`; // Add part of UID
                         const finalUsernameRef = doc(db, "usernames", finalUsername);
                         batch.set(finalUsernameRef, { uid: result.user.uid }); // Set the final username doc
                    } else {
                        batch.set(usernameRef, { uid: result.user.uid }); // Set the default username doc
                    }
                 } catch (usernameCheckError) {
                     console.error("Error checking default username during Google Sign-In:", usernameCheckError);
                     // Proceed with default, might cause issues if it's actually taken but check failed
                     finalUsername = usernameDefault;
                     // Don't attempt to set username doc if check failed
                 }


                // Create user profile in Firestore
                batch.set(userRef, {
                    uid: result.user.uid,
                    name: result.user.displayName,
                    email: result.user.email,
                    username: finalUsername, // Use the final determined username
                    photoURL: result.user.photoURL, // Store initial photoURL from Google
                    createdAt: serverTimestamp(), // Use server timestamp
                    emailVerified: result.user.emailVerified, // Store verification status
                    lastLogin: serverTimestamp(),
                });

                console.log("Firestore user profile scheduled for creation for:", result.user.uid, "with username:", finalUsername);
            } else {
                console.log("Firestore user profile already exists for:", result.user.uid);
                 const existingData = docSnap.data();
                 let updateData: any = {
                    name: result.user.displayName, // Update name
                    photoURL: result.user.photoURL, // Update photoURL
                    emailVerified: result.user.emailVerified, // Update verification status
                    lastLogin: serverTimestamp(),
                 };

                 // Ensure username exists in update data if missing in Firestore (migration case)
                 if (!existingData.username) {
                    updateData.username = usernameDefault; // Add default username if missing
                    // Attempt to claim the username doc if it doesn't exist
                    try {
                       const usernameSnap = await getDoc(usernameRef);
                       if (!usernameSnap.exists()) {
                           batch.set(usernameRef, { uid: result.user.uid });
                           console.log("Firestore username doc scheduled for creation for existing user (migration):", result.user.uid);
                       } else if (usernameSnap.data()?.uid !== result.user.uid) {
                           // Username taken by someone else, generate unique one
                           updateData.username = `${usernameDefault}_${result.user.uid.substring(0, 4)}`;
                           const finalUsernameRef = doc(db, "usernames", updateData.username);
                           batch.set(finalUsernameRef, { uid: result.user.uid });
                           console.warn(`Default username ${usernameDefault} taken during update. Using ${updateData.username}`);
                       }
                    } catch (usernameCheckError) {
                       console.error("Error checking/setting username during profile update:", usernameCheckError);
                       // Don't set username if check fails
                       delete updateData.username;
                    }
                 }


                 // Update existing profile
                 batch.update(userRef, updateData);
                 console.log("Firestore user profile scheduled for update for:", result.user.uid);

            }
             await batch.commit(); // Commit the batch write
             console.log("Firestore batch commit successful.");
      } else {
          console.warn("Firestore not available, skipping profile creation/update.");
      }
      // setLoading will be set to false by onAuthStateChanged
    } catch (error) {
      console.error("Error signing in with Google or updating Firestore: ", error);
      setLoading(false); // Set loading false on error
      throw new Error(handleAuthError(error, 'Failed to sign in with Google.'));
    }
    // No finally block needed for setLoading(false) on success
  };


   const signInWithEmail = async (data: SignInFormData) => {
    if (!auth) throw new Error("Firebase Auth is not initialized.");
    if (!db) console.warn("Firestore is not initialized. Username lookup will fail.");

    setLoading(true);
    let emailToUse = data.email; // Assume input is email initially
    let isUsername = false;

    // Check if input is an email or username
    if (!data.email.includes('@')) {
        isUsername = true;
        if (!db) {
           // If db is not available, cannot perform username lookup
            setLoading(false);
            console.error("Database connection error. Cannot sign in with username.");
            throw new Error("Database connection error. Cannot sign in with username.");
        }
        console.log(`Attempting username lookup for: ${data.email}`);
        // Assume it's a username, query Firestore for the email via the 'usernames' collection
        const usernameDocRef = doc(db, 'usernames', data.email);
        try {
            const usernameDocSnap = await getDoc(usernameDocRef);
            if (!usernameDocSnap.exists()) {
                console.log(`Username not found in 'usernames' collection: ${data.email}`);
                setLoading(false);
                // Use the specific error message from handleAuthError
                throw new Error(handleAuthError({ code: 'auth/user-not-found' }, 'Failed to sign in.'));
            }
            // Get the UID from the username document
            const usernameData = usernameDocSnap.data();
            const userId = usernameData.uid;
            if (!userId) {
                 console.error("Username document found, but UID is missing:", usernameData);
                 setLoading(false);
                 throw new Error('Configuration error: User UID not found for username.');
            }
            // Fetch the user document using the UID to get the email
            const userDocRef = doc(db, 'users', userId);
            const userDocSnap = await getDoc(userDocRef);
            if (!userDocSnap.exists()) {
                 console.error(`User document not found for UID ${userId} (linked to username ${data.email})`);
                 setLoading(false);
                 throw new Error('Configuration error: User profile not found.');
            }
            const userData = userDocSnap.data();
             if (!userData.email) {
                console.error("User document found by UID, but email field is missing:", userData);
                setLoading(false);
                throw new Error('Configuration error: User email not found.');
            }
            emailToUse = userData.email;
            console.log(`Found email ${emailToUse} for username ${data.email}`);
        } catch (firestoreError: any) { // Catch specific Firestore errors
            console.error("Error querying Firestore for username/user:", firestoreError);
            setLoading(false);
            // Handle specific Firestore errors like permission denied
            if (firestoreError.code === 'permission-denied') {
                throw new Error("Database access denied during sign-in. Check Firestore rules.");
            }
             // If the initial error was user not found by username, re-throw that specific message
            if (firestoreError.message.includes('auth/user-not-found')) {
                 throw firestoreError;
            }
            throw new Error("Database error during sign-in. Please try again.");
        }

    }

    console.log(`Attempting sign-in with email: ${emailToUse}`);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, emailToUse, data.password);
      console.log("Email/Password Sign-In successful for:", emailToUse);

       // Update last login time in Firestore
       if (db && userCredential.user) {
           const userRef = doc(db, "users", userCredential.user.uid);
           try {
              await setDoc(userRef, { lastLogin: serverTimestamp() }, { merge: true });
              console.log("Last login time updated for user:", userCredential.user.uid);
           } catch (updateError: any) { // Catch potential update errors
               console.error("Error updating last login time:", updateError);
               // Non-critical error, proceed with login, but maybe log or notify
               if (updateError.code === 'permission-denied') {
                    console.warn("Permission denied updating last login time. Check Firestore rules for user document updates.");
               }
           }
       }

      // onAuthStateChanged will handle setting the user and setLoading(false)
    } catch (error) {
      console.error("Error signing in with email/username: ", error);
      setLoading(false); // Set loading false ONLY on error
       // Use the handleAuthError function to get a user-friendly message
       throw new Error(handleAuthError(error, 'Failed to sign in.'));
    }
    // No finally block needed here for setLoading(false) on success.
  };


  const signUpWithEmail = async (data: SignUpFormData) => {
     if (!auth) throw new Error("Firebase Auth is not initialized.");
     if (!db) {
        console.error("Firestore is not initialized. Cannot create user profile or check username.");
        throw new Error("Database connection error. Cannot complete sign-up.");
     }

    setLoading(true);
    console.log(`Attempting sign-up for email: ${data.email}, username: ${data.username}`);

    // --- Check if username already exists in the 'usernames' collection ---
    const usernameRef = doc(db, 'usernames', data.username);

    try {
        // Add validation to ensure username is not empty or just spaces
        if (!data.username || data.username.trim() === '') {
            setLoading(false);
            throw new Error("Username cannot be empty.");
        }
        const usernameSnapshot = await getDoc(usernameRef);
        if (usernameSnapshot.exists()) {
            console.log(`Username already taken: ${data.username}`);
            setLoading(false);
            throw new Error('Username is already taken.');
        }
         console.log(`Username available: ${data.username}`);
    } catch (firestoreError: any) { // Catch Firestore specific errors
        console.error("Error checking username existence:", firestoreError);
        setLoading(false);
         // Provide a more specific error message if possible
          if (firestoreError.code === 'permission-denied') {
            console.error("PERMISSION DENIED checking username. Ensure Firestore rules allow reads on the 'usernames' collection for authenticated or potentially unauthenticated users during signup check if necessary.");
            throw new Error("Database permission error during sign-up check. Please contact support if this persists.");
         }
        // Use handleAuthError for consistency, though this is a Firestore error
         throw new Error(`Database error during sign-up check: ${firestoreError instanceof Error ? firestoreError.message : 'Please try again.'}`);
    }
    // --- End Username Check ---


    let userCredential;
    try {
      // --- Create Firebase Auth user ---
      userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      console.log("Firebase Auth user created:", userCredential.user.uid);

      // Update Auth profile with name AND photoURL if available
      await updateProfile(userCredential.user, {
        displayName: data.name,
        photoURL: userCredential.user.photoURL // Try to get photoURL from created user (might be null)
      });
       console.log("Firebase Auth profile updated with name:", data.name, "and photoURL:", userCredential.user.photoURL);
       // --- End Auth User Creation ---


       // --- Create Firestore documents using a Batch Write ---
       const batch = writeBatch(db);

       // 1. User document in 'users' collection
       const userDocRef = doc(db, "users", userCredential.user.uid);
       batch.set(userDocRef, {
         uid: userCredential.user.uid,
         name: data.name,
         username: data.username,
         email: data.email,
         mobile: data.mobile || null, // Store mobile number or null
         photoURL: userCredential.user.photoURL || null, // Store photoURL from Auth or null
         createdAt: serverTimestamp(), // Use server timestamp
         emailVerified: false, // Initially set to false
         lastLogin: serverTimestamp(), // Add initial lastLogin timestamp
       });

       // 2. Username document in 'usernames' collection (for uniqueness lookup)
       const usernameDocRef = doc(db, "usernames", data.username);
       batch.set(usernameDocRef, {
         uid: userCredential.user.uid,
       });

       await batch.commit(); // Atomically write both documents
       console.log("Firestore user and username documents created successfully for:", userCredential.user.uid);
       // --- End Firestore Batch Write ---


      // --- Send verification email ---
      try {
        await sendEmailVerification(userCredential.user);
        console.log("Verification email sent to:", userCredential.user.email);
        // The success message in SignUpPage already informs the user.
      } catch (verificationError) {
        console.error("Error sending verification email:", verificationError);
        // Log the error but don't fail the entire signup because of it
        // Maybe show a specific message later if needed
      }
      // --- End Verification Email ---

      // Sign up successful. User is created but not yet verified.
      // onAuthStateChanged will set loading to false and user state.
      // The UI should prompt the user to check their email for verification.
       setLoading(false); // Explicitly set loading false after successful completion

    } catch (error) {
      console.error("Error during sign-up process: ", error);
      setLoading(false); // Set loading false on any error in the process

      // Attempt to clean up Auth user if Firestore write failed (optional but good practice)
      if (userCredential && error instanceof Error && !(error as AuthError).code?.startsWith('auth/')) { // Check if it's likely a Firestore/DB error
          try {
              await userCredential.user.delete();
              console.log("Cleaned up partially created Auth user:", userCredential.user.uid);
          } catch (deleteError) {
              console.error("Failed to clean up partially created Auth user:", deleteError);
          }
      }

      // Specific check for configuration-not-found
      if (error instanceof Error && 'code' in error && (error as AuthError).code === 'auth/configuration-not-found') {
        console.error("SIGN UP FAILED due to 'auth/configuration-not-found'. Ensure the Email/Password provider is ENABLED in the Firebase Console (Authentication -> Sign-in method).");
      }
      throw new Error(handleAuthError(error, 'Failed to sign up.'));
    }
  };


  const signOutUser = async () => {
     if (!auth) {
      console.error("Firebase Auth is not initialized. Cannot sign out.");
      setUser(null);
      setLoading(false);
      return;
    }
    console.log("Attempting Sign Out...");
    setLoading(true); // Indicate loading during sign out process
    try {
      await signOut(auth);
       console.log("Sign Out successful.");
       // onAuthStateChanged will handle setting the user to null and setLoading(false)
    } catch (error) {
       console.error("Error signing out: ", error);
       setUser(auth.currentUser); // Re-set to current user if sign-out failed
       setLoading(false); // Ensure loading is set to false on error
       throw new Error(handleAuthError(error, 'Failed to sign out.'));
    }
  };

  const value = {
    user,
    loading,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOutUser,
  };

  // Display loading only while auth state is initially resolving or user logs out
   const showLoadingScreen = loading; // Simplified: Show loading whenever loading is true

  return (
    <AuthContext.Provider value={value}>
      {showLoadingScreen ? (
         <div className="flex items-center justify-center min-h-screen bg-secondary">
           <Loader2 className="h-12 w-12 animate-spin text-primary" />
           <p className="ml-2 text-muted-foreground">Authenticating...</p>
         </div>
      ) : children }
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
