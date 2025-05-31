import { initializeApp, getApps, getApp, FirebaseOptions } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth'; // Import connectAuthEmulator
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage'; // Import Storage

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  // measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID // Optional
};

// --- IMPORTANT FIREBASE CONFIGURATION NOTES ---
// 1. Ensure all NEXT_PUBLIC_FIREBASE_... variables in your .env.local or .env file are correct
//    and match your Firebase project settings. Restart your dev server after changes.
// 2. Check for common errors:
//    - 'auth/invalid-api-key' or 'auth/api-key-not-valid': Double-check NEXT_PUBLIC_FIREBASE_API_KEY.
//    - 'auth/configuration-not-found':
//        * MOST LIKELY CAUSE: The Email/Password and/or Google Sign-in providers are NOT ENABLED
//          in the Firebase Console. Go to your Firebase project -> Authentication -> Sign-in method ->
//          Enable "Email/Password" and "Google".
//        * Also verify PROJECT_ID and AUTH_DOMAIN in your environment variables.
//    - 'auth/unauthorized-domain':
//        * CAUSE: The domain you are running your app from (e.g., `localhost`) is not listed in the
//          "Authorized domains" in your Firebase project settings.
//        * FIX: Go to your Firebase project -> Authentication -> Settings -> Authorized domains ->
//          Click "Add domain" and enter `localhost` (or the specific domain/port you are using for development).
//    - 'auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password': Check email/password combination or if the user exists.
//    - 'permission-denied' in Firestore/Storage: Check your Security Rules (see below).
//    - 'failed-precondition': Often indicates a missing Firestore index needed for a query, or trying an operation that violates constraints (like writing to a non-existent document path in certain ways). Check Firestore indexes or structure.
// --------------------------------------------
//
// --- RECOMMENDED SECURITY RULES (Apply these in your Firebase Console) ---
// **Firestore Rules (firestore.rules):**
// rules_version = '2';
// service cloud.firestore {
//   match /databases/{database}/documents {
//     // Users collection: Users can read/update their own profile, must be verified to update.
//     match /users/{userId} {
//       allow read: if request.auth != null && request.auth.uid == userId;
//       allow create: if request.auth != null && request.auth.uid == userId; // Allow creation during signup
//       allow update: if request.auth != null && request.auth.uid == userId && request.auth.token.email_verified == true
//                       && request.resource.data.uid == userId // Ensure UID cannot be changed
//                       && request.resource.data.createdAt == resource.data.createdAt; // Prevent changing createdAt
//       // Deny delete for user profiles
//       allow delete: if false;
//
//       // Chats subcollection: Users can manage their own chats, must be verified.
//       match /chats/{chatId} {
//         allow read, create, update, delete: if request.auth != null && request.auth.uid == userId && request.auth.token.email_verified == true;
//         // Optional validation for chat document structure:
//         // allow create: if request.auth != null && request.auth.uid == userId && request.auth.token.email_verified == true
//         //                 && request.resource.data.keys().hasAll(['title', 'createdAt', 'messages'])
//         //                 && request.resource.data.title is string
//         //                 && request.resource.data.messages is list;
//         // allow update: if request.auth != null && request.auth.uid == userId && request.auth.token.email_verified == true
//         //                  // Add specific field update validation if needed, e.g., allow updating title or messages array
//         //                  && request.resource.data.createdAt == resource.data.createdAt; // Prevent changing createdAt
//       }
//     }
//
//     // Usernames collection for unique username lookup
//     match /usernames/{username} {
//       // Allow ANY logged-in user to read (needed for signup username availability check)
//       allow read: if request.auth != null;
//       // Allow creating username doc only if user is creating their own mapping
//       // and the username doesn't exist yet.
//       allow create: if request.auth != null && request.resource.data.uid == request.auth.uid;
//       // Prevent updating or deleting username docs
//       allow update, delete: if false;
//     }
//   }
// }
//
// **Storage Rules (storage.rules):**
// rules_version = '2';
// service firebase.storage {
//   match /b/{bucket}/o {
//     // Users can only read/write their own profile pictures, must be verified.
//     // Add size and content type validation for security.
//     match /profilePictures/{userId}/{fileName} {
//       allow read: if request.auth != null; // Allow anyone logged in to read profile pics (adjust if needed)
//       allow write: if request.auth != null && request.auth.uid == userId && request.auth.token.email_verified == true
//                    && request.resource.size < 5 * 1024 * 1024 // Max 5MB
//                    && request.resource.contentType.matches('image/.*'); // Only allow images
//     }
//
//     // Disallow writing/reading anywhere else by default
//     // match /{allPaths=**} {
//     //   allow read, write: if false;
//     // }
//   }
// }
// --------------------------------------------


let app;
let auth: ReturnType<typeof getAuth> | null = null;
let db: ReturnType<typeof getFirestore> | null = null;
let storage: ReturnType<typeof getStorage> | null = null; // Add storage variable

// Basic check if required config values are present
const requiredConfigKeys: (keyof FirebaseOptions)[] = ['apiKey', 'authDomain', 'projectId', 'storageBucket']; // Add storageBucket
const missingKeys = requiredConfigKeys.filter(key => !firebaseConfig[key] || (firebaseConfig[key] as string).includes('YOUR_'));

if (missingKeys.length > 0) {
  console.error(`
    *************************************************************************
    ERROR: Firebase configuration is incomplete or uses placeholder values.
    Missing or invalid keys: ${missingKeys.join(', ')}
    Please ensure all NEXT_PUBLIC_FIREBASE_... variables are correctly
    set in your .env or .env.local file and restart your server.
    Firebase features will likely fail.
    See https://firebase.google.com/docs/web/setup#config-object
    *************************************************************************
  `);
} else {
    // Initialize Firebase
    try {
        if (!getApps().length) {
        app = initializeApp(firebaseConfig);
        console.log("Firebase initialized successfully!");
        } else {
        app = getApp();
        console.log("Using existing Firebase app instance.");
        }
    } catch (error) {
        console.error("Firebase initialization error:", error);
        // Firebase is likely critical, so set app to null to prevent further errors.
        app = null;
    }

    // Conditionally get services only if app initialized successfully
    if (app) {
        try {
            auth = getAuth(app);
            console.log("Firebase Auth initialized.");
        } catch (error) {
            console.error("Firebase Auth initialization error:", error);
            auth = null;
        }

        try {
            db = getFirestore(app);
            console.log("Firebase Firestore initialized.");

             // Initialize Storage here, regardless of emulator usage
            storage = getStorage(app);
            console.log("Firebase Storage initialized.");

             // Example check for Firebase Emulator (useful for local development)
             // Make sure this logic doesn't run in production
             if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true') {
               try {
                 console.log("Attempting to connect to Firebase emulators...");
                 // Default ports: Auth: 9099, Firestore: 8080, Storage: 9199
                 // Ensure these match your emulator setup (firebase.json)
                 connectFirestoreEmulator(db, 'localhost', 8080);
                 console.log("Connected to Firestore emulator on port 8080.");

                 if(auth) { // Check if auth is initialized before connecting emulator
                   connectAuthEmulator(auth, 'http://localhost:9099');
                   console.log("Connected to Auth emulator on port 9099.");
                 }

                 // Connect Storage emulator (storage should be initialized above)
                 if (storage) {
                   connectStorageEmulator(storage, 'localhost', 9199);
                   console.log("Connected to Storage emulator on port 9199.");
                 } else {
                    console.warn("Storage not initialized, cannot connect to emulator.");
                 }

               } catch (emulatorError) {
                 console.error("Error connecting to Firebase emulator:", emulatorError);
                 // Continue without emulator if connection fails
               }
             } else {
                console.log("Not using Firebase emulators.");
             }

        } catch (error) {
            console.error("Firebase Firestore/Storage initialization error:", error);
            db = null;
            storage = null; // Ensure storage is null if there was an error
        }

        // const analytics = app ? getAnalytics(app) : null; // Optional
    } else {
        console.error("Firebase app failed to initialize. Auth, Firestore, and Storage services will not be available.");
    }
}

export { app, auth, db, storage }; // Export storage
