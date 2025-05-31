
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Upload, User as UserIcon, Save, KeyRound } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { storage, db, auth } from '@/lib/firebase'; // Import storage
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'; // Import storage functions
import { doc, getDoc, updateDoc, writeBatch } from 'firebase/firestore'; // Import getDoc and writeBatch
import { updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { Progress } from '@/components/ui/progress'; // Import Progress
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Separator } from '@/components/ui/separator'; // Import Separator

// Enhanced Zod schema for settings form
const settingsSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }).max(50, { message: 'Name cannot exceed 50 characters.' }),
  username: z.string().min(3, { message: 'Username must be at least 3 characters.' }).regex(/^[a-zA-Z0-9_]+$/, { message: 'Username can only contain letters, numbers, and underscores.' }),
  mobile: z.string().optional().refine(val => !val || /^\+?[1-9]\d{1,14}$/.test(val), {
    message: 'Invalid mobile number format (e.g., +1234567890).',
  }),
  // Password change fields (optional, only validate if newPassword has value)
  currentPassword: z.string().optional(), // Needed for re-authentication if required by Firebase
  newPassword: z.string().optional(),
  confirmPassword: z.string().optional(),
}).refine(data => {
  // If newPassword is provided, confirmPassword must match
  if (data.newPassword && data.newPassword !== data.confirmPassword) {
    return false;
  }
  // If newPassword is provided, it must be at least 6 characters
  if (data.newPassword && data.newPassword.length < 6) {
      return false;
  }
  return true;
}, {
  // Apply error message to confirmPassword if they don't match
  message: "Passwords don't match or new password is less than 6 characters.",
  path: ["confirmPassword"], // Attach the error to the confirmPassword field
});

type SettingsFormData = z.infer<typeof settingsSchema>;

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [userData, setUserData] = useState<any>(null); // Store fetched user data from Firestore
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      name: '',
      username: '',
      mobile: '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

   // Fetch user data from Firestore on mount
  useEffect(() => {
    const fetchUserData = async () => {
        if (user && db) {
            const userDocRef = doc(db, 'users', user.uid);
            try {
                const docSnap = await getDoc(userDocRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setUserData(data);
                    // Populate form with fetched data
                    form.reset({
                        name: data.name || user.displayName || '',
                        username: data.username || '',
                        mobile: data.mobile || '',
                        currentPassword: '', // Keep password fields empty initially
                        newPassword: '',
                        confirmPassword: '',
                    });
                     setPreviewUrl(data.photoURL || user.photoURL || null); // Set initial preview
                } else {
                    console.warn("User document not found in Firestore.");
                     // Populate form with auth data as fallback
                     form.reset({
                        name: user.displayName || '',
                        username: '', // No username in auth typically
                        mobile: '',
                        currentPassword: '',
                        newPassword: '',
                        confirmPassword: '',
                    });
                     setPreviewUrl(user.photoURL || null);
                }
            } catch (error) {
                console.error("Error fetching user data:", error);
                toast({ variant: "destructive", title: "Error", description: "Could not load user profile data." });
                 // Populate form with auth data as fallback
                 form.reset({
                    name: user.displayName || '',
                    username: '',
                    mobile: '',
                    currentPassword: '',
                    newPassword: '',
                    confirmPassword: '',
                });
                 setPreviewUrl(user.photoURL || null);
            }
        }
    };

    if (!loading && user) {
        fetchUserData();
    }
  }, [user, loading, form, toast, db]); // Added db dependency

  useEffect(() => {
    if (selectedFile) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    } else {
       // Revert to original photoURL if selection is cancelled
       setPreviewUrl(userData?.photoURL || user?.photoURL || null);
    }
  }, [selectedFile, userData, user]); // Added userData and user dependencies

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (!file.type.startsWith('image/')) {
        toast({ variant: 'destructive', title: 'Invalid File Type', description: 'Please select an image file.' });
        return;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
         toast({ variant: 'destructive', title: 'File Too Large', description: 'Please select an image smaller than 5MB.' });
         return;
      }
      setSelectedFile(file);
    }
  };

  // Separate function for profile picture upload
  const handleUploadProfilePicture = async () => {
     if (!selectedFile || !user || !auth.currentUser || isUploading || isSaving) return;
     if (!storage || !db) {
         toast({ variant: 'destructive', title: 'Configuration Error', description: 'Storage/Database not configured.' });
         return;
     }

    setIsUploading(true);
    setUploadProgress(0);

    const fileExtension = selectedFile.name.split('.').pop();
    const storageRef = ref(storage, `profilePictures/${user.uid}/profile.${fileExtension}`);
    const uploadTask = uploadBytesResumable(storageRef, selectedFile);

    uploadTask.on('state_changed',
      (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
      (error) => {
        console.error('Upload failed:', error);
        setIsUploading(false); setUploadProgress(0); setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        toast({ variant: 'destructive', title: 'Upload Failed', description: `Error: ${error.message}. Check storage rules.` });
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          const userDocRef = doc(db, 'users', user.uid);
          const batch = writeBatch(db);
          batch.update(userDocRef, { photoURL: downloadURL }); // Update Firestore

           if (auth.currentUser) {
             await updateProfile(auth.currentUser, { photoURL: downloadURL }); // Update Auth profile
           }

          await batch.commit();

          setIsUploading(false); setUploadProgress(100);
          toast({ title: 'Profile Picture Updated' });
          setSelectedFile(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
           // Keep the preview URL updated to the new URL
           setPreviewUrl(downloadURL);
           setUserData((prev: any) => ({ ...prev, photoURL: downloadURL })); // Update local user data state

          setTimeout(() => setUploadProgress(0), 1500);
        } catch (updateError: any) {
          console.error('Error updating profile:', updateError);
          setIsUploading(false); setUploadProgress(0); setSelectedFile(null);
           if (fileInputRef.current) fileInputRef.current.value = '';
          toast({ variant: 'destructive', title: 'Update Failed', description: `Failed to save picture URL: ${updateError.message}. Check Firestore/Auth rules.` });
        }
      }
    );
  };


  const onSubmit = async (data: SettingsFormData) => {
    if (!user || !auth.currentUser || !db) {
      toast({ variant: 'destructive', title: 'Error', description: 'User not logged in or database unavailable.' });
      return;
    }

    setIsSaving(true);
    const userDocRef = doc(db, 'users', user.uid);
    const batch = writeBatch(db);
    let authProfileUpdates: { displayName?: string | null } = {};
    let needsUsernameUpdate = false;
    const originalUsername = userData?.username || '';
    const newUsername = data.username.trim();

    // --- Prepare Profile Updates ---
    const profileUpdates: any = {};
    if (data.name.trim() !== (userData?.name || user.displayName)) {
        profileUpdates.name = data.name.trim();
        authProfileUpdates.displayName = data.name.trim();
    }
     if (newUsername && newUsername !== originalUsername) {
         profileUpdates.username = newUsername;
         needsUsernameUpdate = true;
    }
    if (data.mobile?.trim() !== (userData?.mobile || '')) {
        profileUpdates.mobile = data.mobile?.trim() || null; // Store null if empty
    }

     // --- Handle Username Change ---
     if (needsUsernameUpdate) {
        // 1. Check if new username is available
        const newUsernameRef = doc(db, 'usernames', newUsername);
        try {
            const usernameSnap = await getDoc(newUsernameRef);
            if (usernameSnap.exists()) {
                form.setError("username", { type: "manual", message: "Username is already taken." });
                setIsSaving(false);
                return;
            }
            // 2. Schedule deleting old username doc (if exists)
            if (originalUsername) {
                const oldUsernameRef = doc(db, 'usernames', originalUsername);
                batch.delete(oldUsernameRef);
            }
            // 3. Schedule creating new username doc
            batch.set(newUsernameRef, { uid: user.uid });
            console.log(`Username update scheduled: ${originalUsername} -> ${newUsername}`);
        } catch (error) {
            console.error("Error checking/updating username:", error);
            toast({ variant: "destructive", title: "Username Error", description: "Could not verify or update username." });
            setIsSaving(false);
            return;
        }
    }


    // --- Prepare Firestore Update ---
    if (Object.keys(profileUpdates).length > 0) {
        batch.update(userDocRef, profileUpdates);
         console.log("Firestore profile update scheduled:", profileUpdates);
    }

    // --- Handle Password Change ---
    let passwordChangePromise = Promise.resolve(); // Promise for password change
    if (data.newPassword && data.newPassword === data.confirmPassword && data.newPassword.length >= 6) {
        passwordChangePromise = updatePassword(auth.currentUser, data.newPassword)
            .then(() => {
                console.log("Password updated successfully in Firebase Auth.");
                // Clear password fields after successful update
                 form.reset({ ...form.getValues(), currentPassword: '', newPassword: '', confirmPassword: '' });
            })
            .catch(async (error) => {
                console.error("Error updating password:", error);
                let errorMessage = "Failed to update password.";
                // Handle re-authentication requirement
                if (error.code === 'auth/requires-recent-login') {
                    errorMessage = "Security check: Please re-enter your current password to change it.";
                     // Prompt user for current password (you might need a modal or dedicated input field for this)
                    // For simplicity here, we'll just show the error and require `currentPassword` field
                    if (!data.currentPassword) {
                       form.setError("currentPassword", { type: "manual", message: "Enter current password to change." });
                       throw new Error(errorMessage); // Stop execution if current password wasn't provided
                    }
                    try {
                        const credential = EmailAuthProvider.credential(user.email!, data.currentPassword);
                        await reauthenticateWithCredential(auth.currentUser!, credential);
                        // Retry password update after re-authentication
                        await updatePassword(auth.currentUser!, data.newPassword!);
                        console.log("Password updated successfully after re-authentication.");
                         // Clear password fields after successful update
                         form.reset({ ...form.getValues(), currentPassword: '', newPassword: '', confirmPassword: '' });
                    } catch (reauthError: any) {
                        console.error("Re-authentication or retry password update failed:", reauthError);
                        errorMessage = `Re-authentication failed (${reauthError.code}). Could not update password.`;
                        if (reauthError.code === 'auth/wrong-password' || reauthError.code === 'auth/invalid-credential') {
                            form.setError("currentPassword", { type: "manual", message: "Incorrect current password." });
                        } else {
                            form.setError("currentPassword", { type: "manual", message: `Re-auth error: ${reauthError.code}` });
                        }
                         throw new Error(errorMessage); // Throw to prevent optimistic success toast
                    }
                } else if (error.code === 'auth/weak-password') {
                    form.setError("newPassword", { type: "manual", message: "Password is too weak (min 6 chars)." });
                     throw new Error("Password is too weak.");
                }
                else {
                     form.setError("newPassword", { type: "manual", message: `Error: ${error.code}` });
                     throw new Error(errorMessage);
                }
            });
    }


    // --- Execute Updates ---
    try {
        // Update Auth profile first (if needed)
        if (Object.keys(authProfileUpdates).length > 0) {
            await updateProfile(auth.currentUser, authProfileUpdates);
            console.log("Firebase Auth profile updated:", authProfileUpdates);
        }

        // Commit Firestore batch (if any changes)
        if (Object.keys(profileUpdates).length > 0 || needsUsernameUpdate) {
            await batch.commit();
            console.log("Firestore updates committed successfully.");
        }

        // Wait for password change promise (if initiated)
        await passwordChangePromise;

        toast({ title: 'Profile Updated Successfully!' });
        setUserData((prev: any) => ({ ...prev, ...profileUpdates })); // Update local state
    } catch (error: any) {
        console.error('Error saving profile:', error);
        toast({ variant: 'destructive', title: 'Save Failed', description: error.message || 'An unexpected error occurred.' });
    } finally {
        setIsSaving(false);
    }
  };


  const getInitials = (name: string | null | undefined): string => {
    if (!name) return '?';
    const names = name.trim().split(' ');
    if (names.length === 1 && names[0] === '') return '?';
    if (names.length === 1) return names[0][0].toUpperCase();
    return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
  };

  if (loading || (!user && !loading)) { // Show loading while loading or if user is null after loading
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
         {!user && !loading && <p className="ml-2">Redirecting...</p>}
      </div>
    );
  }

  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Account Settings</CardTitle>
        <CardDescription>Manage your profile and account settings.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

            {/* Profile Picture Section */}
             <div className="flex flex-col items-center space-y-4 border-b pb-6">
               <h3 className="text-lg font-medium self-start mb-2">Profile Picture</h3>
               <Avatar className="h-24 w-24 ring-2 ring-primary ring-offset-2 ring-offset-background">
                  <AvatarImage src={previewUrl || undefined} alt={form.getValues('name') || 'User'} />
                 <AvatarFallback className="text-3xl bg-secondary text-secondary-foreground">
                   {getInitials(form.getValues('name'))}
                 </AvatarFallback>
               </Avatar>
               <div className="grid w-full max-w-sm items-center gap-1.5">
                 <Label htmlFor="picture">Change Picture</Label>
                 <Input
                    id="picture"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    ref={fileInputRef}
                    disabled={isUploading || isSaving}
                    className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
                 />
                 {uploadProgress > 0 && (
                    <Progress value={uploadProgress} className="w-full h-2 mt-2" />
                 )}
                  <Button
                     type="button" // Important: prevent form submission
                     onClick={handleUploadProfilePicture}
                     disabled={!selectedFile || isUploading || isSaving}
                     className="mt-2 w-full"
                   >
                     {isUploading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...
                        </>
                     ) : (
                        <>
                           <Upload className="mr-2 h-4 w-4" /> Upload Picture
                        </>
                     )}
                   </Button>
                  {selectedFile && !isUploading && (
                       <Button variant="outline" size="sm" type="button" onClick={() => {
                           setSelectedFile(null);
                           if (fileInputRef.current) fileInputRef.current.value = '';
                       }} className="mt-1 w-full text-xs" disabled={isSaving}>
                         Cancel Selection
                       </Button>
                   )}
               </div>
             </div>


            {/* Personal Information Section */}
            <div className="space-y-4 border-b pb-6">
                <h3 className="text-lg font-medium">Personal Information</h3>
               <FormField
                 control={form.control}
                 name="name"
                 render={({ field }) => (
                   <FormItem>
                     <FormLabel>Full Name</FormLabel>
                     <FormControl>
                       <Input placeholder="Your full name" {...field} disabled={isSaving} />
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
                       <Input placeholder="Your unique username" {...field} disabled={isSaving} />
                     </FormControl>
                      <p className="text-xs text-muted-foreground">Letters, numbers, underscores only. Changing username requires re-login on other devices.</p>
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
                       <Input type="tel" placeholder="+1234567890" {...field} disabled={isSaving} />
                     </FormControl>
                     <FormMessage />
                   </FormItem>
                 )}
               />
                <div className="space-y-2">
                   <Label>Email</Label>
                   <Input value={user?.email || 'Not set'} disabled className="cursor-not-allowed bg-muted/50" />
                   <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
                </div>
            </div>

            {/* Password Change Section */}
             <div className="space-y-4">
                <h3 className="text-lg font-medium">Change Password</h3>
                 <FormField
                  control={form.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Enter current password (if changing)" {...field} disabled={isSaving} />
                      </FormControl>
                       <p className="text-xs text-muted-foreground">Required only if you are setting a new password.</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Enter new password (min 6 chars)" {...field} disabled={isSaving} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm New Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Confirm new password" {...field} disabled={isSaving} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
             </div>

             <CardFooter className="px-0 pt-6">
                 <Button type="submit" disabled={isSaving || isUploading || !form.formState.isDirty} className="w-full sm:w-auto">
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Changes
                 </Button>
                 {!form.formState.isDirty && <p className="ml-4 text-sm text-muted-foreground">No changes to save.</p>}
            </CardFooter>

          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
