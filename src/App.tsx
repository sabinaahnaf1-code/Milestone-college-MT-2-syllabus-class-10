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

  const motivationalQuotes = [
    "Success is the sum of small efforts, repeated day in and day out.",
    "The secret of getting ahead is getting started.",
    "Don't stop until you're proud.",
    "Your only limit is you.",
    "Believe you can and you're halfway there.",
    "Hard work beats talent when talent doesn't work hard."
  ];

  const randomQuote = motivationalQuotes[Math.floor((overallProgress / 20) % motivationalQuotes.length)];

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900">
      <Toaster position="top-center" />
      
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white">
              <GraduationCap className="h-5 w-5" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">MT-2 Tracker</h1>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-medium">{user.displayName || user.email}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={handleSignOut} className="h-8 w-8 text-zinc-500 hover:text-zinc-900">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        {/* Overall Progress Section - Now at Top */}
        <section className="mb-6">
          <Card className="border-zinc-200 shadow-sm overflow-hidden bg-white">
            <div className="h-1.5 bg-zinc-900" />
            <CardContent className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <LayoutDashboard className="h-5 w-5 text-zinc-500" />
                    Overall Progress
                  </h2>
                  <p className="text-sm text-zinc-500 italic">"{randomQuote}"</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-2xl font-black">{Math.round(overallProgress)}%</div>
                    <div className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Completed</div>
                  </div>
                  <div className="relative h-14 w-14 flex items-center justify-center">
                    <svg className="h-full w-full -rotate-90 transform">
                      <circle
                        cx="28"
                        cy="28"
                        r="24"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="transparent"
                        className="text-zinc-100"
                      />
                      <motion.circle
                        cx="28"
                        cy="28"
                        r="24"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="transparent"
                        strokeDasharray={2 * Math.PI * 24}
                        initial={{ strokeDashoffset: 2 * Math.PI * 24 }}
                        animate={{ strokeDashoffset: 2 * Math.PI * 24 * (1 - overallProgress / 100) }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        strokeLinecap="round"
                        className="text-zinc-900"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Trophy className={`h-5 w-5 ${overallProgress === 100 ? 'text-yellow-500' : 'text-zinc-300'}`} />
                    </div>
                  </div>
                </div>
              </div>
              <Progress value={overallProgress} className="h-2 mt-4 bg-zinc-100" />
              
              <div className="grid grid-cols-3 gap-2 mt-4">
                <div className="text-center p-2 rounded-lg bg-zinc-50 border border-zinc-100">
                  <div className="text-lg font-bold">{Object.values(progress).filter(Boolean).length}</div>
                  <div className="text-[9px] text-zinc-400 uppercase font-bold">Done</div>
                </div>
                <div className="text-center p-2 rounded-lg bg-zinc-50 border border-zinc-100">
                  <div className="text-lg font-bold">
                    {syllabusData.reduce((acc, sub) => acc + sub.chapters.length, 0) - Object.values(progress).filter(Boolean).length}
                  </div>
                  <div className="text-[9px] text-zinc-400 uppercase font-bold">Left</div>
                </div>
                <div className="text-center p-2 rounded-lg bg-zinc-50 border border-zinc-100">
                  <div className="text-lg font-bold">{syllabusData.length}</div>
                  <div className="text-[9px] text-zinc-400 uppercase font-bold">Subjects</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <Tabs defaultValue={syllabusData[0].name} className="w-full">
          {/* Subject Selection - Sticky below progress */}
          <div className="sticky top-[60px] z-40 -mx-4 mb-6 bg-zinc-50/95 px-4 py-3 backdrop-blur-sm sm:-mx-6 sm:px-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Select Subject</h3>
              {overallProgress > 0 && (
                <Badge variant="outline" className="text-[10px] font-bold border-zinc-200 text-zinc-500">
                  Keep Pushing! 🚀
                </Badge>
              )}
            </div>
            <div className="w-full overflow-x-auto scrollbar-hide">
              <TabsList className="inline-flex h-10 w-max items-center justify-start gap-2 bg-transparent p-0">
                {syllabusData.map((subject) => (
                  <TabsTrigger 
                    key={subject.name} 
                    value={subject.name}
                    className="rounded-full border border-zinc-200 bg-white px-5 py-1.5 text-xs font-bold transition-all data-[state=active]:border-zinc-900 data-[state=active]:bg-zinc-900 data-[state=active]:text-white data-[state=active]:shadow-sm hover:bg-zinc-50"
                  >
                    {subject.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </div>

          {/* Content Area */}
          <AnimatePresence mode="wait">
            {syllabusData.map((subject) => (
              <TabsContent key={subject.name} value={subject.name} className="mt-0 outline-none">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between px-1">
                    <div>
                      <h2 className="text-2xl font-black tracking-tight">{subject.name}</h2>
                      <p className="text-xs text-zinc-400 font-medium">
                        {subject.chapters.filter(ch => progress[`${subject.name}_${ch.id}`]).length} of {subject.chapters.length} completed
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold">{Math.round(calculateSubjectProgress(subject))}%</div>
                      <div className="w-24 h-1.5 bg-zinc-100 rounded-full overflow-hidden mt-1">
                        <div 
                          className="h-full bg-zinc-900 transition-all duration-500" 
                          style={{ width: `${calculateSubjectProgress(subject)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    {subject.chapters.map((chapter, index) => {
                      const isCompleted = !!progress[`${subject.name}_${chapter.id}`];
                      return (
                        <motion.div 
                          key={chapter.id}
                          whileTap={{ scale: 0.98 }}
                          className={`group flex items-center justify-between rounded-2xl border p-4 transition-all duration-200 cursor-pointer ${
                            isCompleted 
                              ? 'border-zinc-200 bg-zinc-100/50 opacity-80' 
                              : 'border-white bg-white shadow-sm hover:shadow-md hover:border-zinc-200'
                          }`}
                          onClick={() => toggleProgress(subject.name, chapter.id)}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black ${
                              isCompleted ? 'bg-zinc-200 text-zinc-500' : 'bg-zinc-900 text-white'
                            }`}>
                              {index + 1}
                            </div>
                            <div>
                              <div className={`text-sm font-bold transition-colors ${isCompleted ? 'text-zinc-400 line-through' : 'text-zinc-900'}`}>
                                {chapter.title}
                              </div>
                              <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-tighter">ID: {chapter.id}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Checkbox 
                              checked={isCompleted}
                              onCheckedChange={() => toggleProgress(subject.name, chapter.id)}
                              className="h-6 w-6 rounded-lg border-zinc-200 data-[state=checked]:bg-zinc-900 data-[state=checked]:border-zinc-900"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>

                  {calculateSubjectProgress(subject) === 100 && (
                    <div className="p-6 text-center rounded-3xl bg-zinc-900 text-white shadow-xl">
                      <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-white" />
                      <h4 className="text-lg font-bold">Subject Mastered!</h4>
                      <p className="text-sm text-zinc-400">You've finished all chapters for {subject.name}.</p>
                    </div>
                  )}
                </motion.div>
              </TabsContent>
            ))}
          </AnimatePresence>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="mt-8 pb-12 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-300">
          Built for Excellence • MT-2 2026
        </p>
      </footer>
    </div>
  );
}
