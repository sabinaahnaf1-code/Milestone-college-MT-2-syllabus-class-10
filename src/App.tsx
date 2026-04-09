/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  User
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  setDoc, 
  doc, 
  serverTimestamp,
  getDocFromServer
} from 'firebase/firestore';
import { auth, db, googleProvider } from './firebase';
import { syllabusData, Subject } from './syllabusData';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { 
  BookOpen, 
  CheckCircle2, 
  LogOut, 
  Mail, 
  Lock, 
  User as UserIcon, 
  GraduationCap,
  LayoutDashboard,
  CheckSquare,
  Trophy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Error handling helper as per instructions
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  toast.error("Database error. Please check your connection.");
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [progress, setProgress] = useState<Record<string, boolean>>({});
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Test connection on boot
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !isAuthReady) return;

    const q = query(collection(db, 'progress'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newProgress: Record<string, boolean> = {};
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        newProgress[`${data.subject}_${data.chapter}`] = data.completed;
      });
      setProgress(newProgress);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'progress');
    });

    return () => unsubscribe();
  }, [user, isAuthReady]);

  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success("Signed in with Google!");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
        toast.success("Account created successfully!");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        toast.success("Signed in successfully!");
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      toast.success("Signed out successfully!");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const toggleProgress = async (subject: string, chapterId: string) => {
    if (!user) return;

    const key = `${subject}_${chapterId}`;
    const isCompleted = !progress[key];
    const docId = `${user.uid}_${subject.replace(/\s+/g, '_')}_${chapterId.replace(/\s+/g, '_')}`;

    try {
      await setDoc(doc(db, 'progress', docId), {
        uid: user.uid,
        subject,
        chapter: chapterId,
        completed: isCompleted,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `progress/${docId}`);
    }
  };

  const calculateSubjectProgress = (subject: Subject) => {
    const completedCount = subject.chapters.filter(ch => progress[`${subject.name}_${ch.id}`]).length;
    return (completedCount / subject.chapters.length) * 100;
  };

  const calculateOverallProgress = () => {
    const totalChapters = syllabusData.reduce((acc, sub) => acc + sub.chapters.length, 0);
    const completedChapters = Object.values(progress).filter(Boolean).length;
    return (completedChapters / totalChapters) * 100;
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-800"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 font-sans">
        <Toaster position="top-center" />
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Card className="border-zinc-200 shadow-xl">
            <CardHeader className="space-y-1 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 text-white">
                <GraduationCap className="h-6 w-6" />
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight">MT-2 Syllabus Tracker</CardTitle>
              <CardDescription>
                Sign in to track your study progress
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleEmailAuth} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute top-3 left-3 h-4 w-4 text-zinc-400" />
                    <Input 
                      id="email" 
                      type="email" 
                      placeholder="name@example.com" 
                      className="pl-10"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute top-3 left-3 h-4 w-4 text-zinc-400" />
                    <Input 
                      id="password" 
                      type="password" 
                      placeholder="••••••••" 
                      className="pl-10"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full bg-zinc-900 hover:bg-zinc-800">
                  {isSignUp ? "Create Account" : "Sign In"}
                </Button>
              </form>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-zinc-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-zinc-500">Or continue with</span>
                </div>
              </div>

              <Button variant="outline" className="w-full" onClick={handleGoogleSignIn}>
                <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                  <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
                </svg>
                Google
              </Button>
            </CardContent>
            <CardFooter>
              <Button 
                variant="link" 
                className="w-full text-zinc-600" 
                onClick={() => setIsSignUp(!isSignUp)}
              >
                {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
              </Button>
            </CardFooter>
          </Card>
        </motion.div>
      </div>
    );
  }

  const overallProgress = calculateOverallProgress();

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900">
      <Toaster position="top-center" />
      
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white">
              <GraduationCap className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight hidden sm:block">Syllabus Tracker</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-medium">{user.displayName || user.email}</span>
              <span className="text-xs text-zinc-500">Student</span>
            </div>
            <Button variant="ghost" size="icon" onClick={handleSignOut} className="text-zinc-500 hover:text-zinc-900">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Tabs defaultValue={syllabusData[0].name} className="w-full">
          <div className="sticky top-[73px] z-40 -mx-4 mb-8 bg-zinc-50/80 px-4 py-4 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
            <div className="mx-auto max-w-7xl">
              <div className="w-full overflow-x-auto pb-2 scrollbar-hide">
                <TabsList className="inline-flex h-12 w-max items-center justify-start gap-2 bg-transparent p-0">
                  {syllabusData.map((subject) => (
                    <TabsTrigger 
                      key={subject.name} 
                      value={subject.name}
                      className="rounded-full border border-zinc-200 bg-white px-6 py-2 text-sm font-medium transition-all data-[state=active]:border-zinc-900 data-[state=active]:bg-zinc-900 data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-zinc-100"
                    >
                      {subject.name}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-12">
            {/* Left Column: Overview & Progress */}
            <div className="lg:col-span-4 space-y-6">
              <Card className="border-zinc-200 shadow-sm overflow-hidden">
                <div className="h-2 bg-zinc-900" />
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LayoutDashboard className="h-5 w-5" />
                    Overall Progress
                  </CardTitle>
                  <CardDescription>Your journey to MT-2 excellence</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm font-medium">
                      <span>Completion</span>
                      <span>{Math.round(overallProgress)}%</span>
                    </div>
                    <Progress value={overallProgress} className="h-3 bg-zinc-100" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-xl bg-zinc-50 p-4 border border-zinc-100">
                      <div className="text-xs text-zinc-500 uppercase font-bold tracking-wider mb-1">Completed</div>
                      <div className="text-2xl font-bold">{Object.values(progress).filter(Boolean).length}</div>
                      <div className="text-[10px] text-zinc-400">Chapters</div>
                    </div>
                    <div className="rounded-xl bg-zinc-50 p-4 border border-zinc-100">
                      <div className="text-xs text-zinc-500 uppercase font-bold tracking-wider mb-1">Remaining</div>
                      <div className="text-2xl font-bold">
                        {syllabusData.reduce((acc, sub) => acc + sub.chapters.length, 0) - Object.values(progress).filter(Boolean).length}
                      </div>
                      <div className="text-[10px] text-zinc-400">Chapters</div>
                    </div>
                  </div>

                  {overallProgress === 100 && (
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="flex items-center gap-3 rounded-xl bg-green-50 p-4 border border-green-100 text-green-700"
                    >
                      <Trophy className="h-8 w-8" />
                      <div>
                        <div className="font-bold">Amazing Work!</div>
                        <div className="text-sm">You've completed the entire syllabus.</div>
                      </div>
                    </motion.div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-zinc-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-zinc-500">Subject Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {syllabusData.map((subject) => {
                    const subProgress = calculateSubjectProgress(subject);
                    return (
                      <div key={subject.name} className="space-y-1">
                        <div className="flex justify-between text-xs font-medium">
                          <span>{subject.name}</span>
                          <span>{Math.round(subProgress)}%</span>
                        </div>
                        <Progress value={subProgress} className="h-1.5 bg-zinc-100" />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Content */}
            <div className="lg:col-span-8">
              <AnimatePresence mode="wait">
                {syllabusData.map((subject) => (
                  <TabsContent key={subject.name} value={subject.name} className="mt-0">
                    <motion.div
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Card className="border-zinc-200 shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <div className="space-y-1">
                            <CardTitle className="text-2xl font-bold">{subject.name}</CardTitle>
                            <CardDescription>
                              {subject.chapters.length} chapters to cover
                            </CardDescription>
                          </div>
                          <Badge variant="secondary" className="bg-zinc-100 text-zinc-900 hover:bg-zinc-100">
                            {Math.round(calculateSubjectProgress(subject))}% Done
                          </Badge>
                        </CardHeader>
                        <CardContent className="pt-6">
                          <ScrollArea className="h-[500px] pr-4">
                            <div className="space-y-4">
                              {subject.chapters.map((chapter, index) => {
                                const isCompleted = !!progress[`${subject.name}_${chapter.id}`];
                                return (
                                  <div 
                                    key={chapter.id}
                                    className={`group flex items-center justify-between rounded-xl border p-4 transition-all duration-200 ${
                                      isCompleted 
                                        ? 'border-zinc-200 bg-zinc-50/50' 
                                        : 'border-zinc-100 hover:border-zinc-300 hover:bg-white hover:shadow-md'
                                    }`}
                                  >
                                    <div className="flex items-center gap-4">
                                      <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${
                                        isCompleted ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-500'
                                      }`}>
                                        {index + 1}
                                      </div>
                                      <div>
                                        <div className={`font-semibold transition-colors ${isCompleted ? 'text-zinc-500 line-through' : 'text-zinc-900'}`}>
                                          {chapter.title}
                                        </div>
                                        <div className="text-xs text-zinc-400">ID: {chapter.id}</div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      {isCompleted && (
                                        <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700 hidden sm:flex">
                                          Completed
                                        </Badge>
                                      )}
                                      <Checkbox 
                                        checked={isCompleted}
                                        onCheckedChange={() => toggleProgress(subject.name, chapter.id)}
                                        className="h-6 w-6 rounded-md border-zinc-300 data-[state=checked]:bg-zinc-900 data-[state=checked]:border-zinc-900"
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </ScrollArea>
                        </CardContent>
                      </Card>
                    </motion.div>
                  </TabsContent>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t border-zinc-200 bg-white py-8">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <p className="text-sm text-zinc-500">
            © 2026 MT-2 Syllabus Tracker. Stay focused, stay ahead.
          </p>
        </div>
      </footer>
    </div>
  );
}
