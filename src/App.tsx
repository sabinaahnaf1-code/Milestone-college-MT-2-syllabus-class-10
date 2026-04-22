/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
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
  getDoc,
  getDocs,
  deleteDoc,
  getDocFromServer,
  writeBatch
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
  Trophy,
  ChevronLeft,
  ChevronRight,
  UserCircle,
  Trash2,
  Users,
  ArrowLeft,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useRef } from 'react';

// Custom user type to handle both Firebase and Simple Auth
interface AppUser {
  uid: string;
  displayName?: string | null;
  email?: string | null;
  emailVerified?: boolean;
}

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
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<Record<string, boolean>>({});
  const [isAuthReady, setIsAuthReady] = useState(false);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const isAdmin = (user?.email === 'sabinaahnaf1@gmail.com' || user?.email === 'sabinaahnaf1@gmail') && user?.emailVerified === true;
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
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName,
          email: firebaseUser.email,
          emailVerified: firebaseUser.emailVerified,
        });
      } else {
        setUser(null);
      }
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
  }, [user?.uid, isAuthReady]);

  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success("Signed in with Google!");
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
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-zinc-200 border-t-primary"></div>
      </div>
    );
  }

  if (currentPath === '/admin') {
    return <AdminDashboard user={user} isAdmin={isAdmin} onBack={() => {
      window.history.pushState({}, '', '/');
      setCurrentPath('/');
    }} />;
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
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/20">
                <GraduationCap className="h-6 w-6" />
              </div>
              <CardTitle className="text-2xl font-black tracking-tight text-primary">Milestone Tracker</CardTitle>
              <CardDescription>
                Sign in to track your study progress
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <Button 
                variant="outline" 
                className="w-full h-12 text-base border-zinc-200 hover:bg-primary/5 hover:text-primary transition-all font-bold rounded-2xl" 
                onClick={handleGoogleSignIn}
              >
                <svg className="mr-3 h-5 w-5" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                  <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
                </svg>
                Sign in with Google
              </Button>
            </CardContent>
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
      <header className="sticky top-0 z-50 border-b border-zinc-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white shadow-sm shadow-primary/20">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-tight text-primary leading-none">Milestone</h1>
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Campus</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <nav className="hidden md:flex items-center gap-6 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              <span className="text-primary border-b-2 border-primary pb-1">Dashboard</span>
              <span className="hover:text-primary transition-colors cursor-pointer">Library</span>
              <span className="hover:text-primary transition-colors cursor-pointer">Lost & Found</span>
            </nav>
            <div className="flex items-center gap-3 pl-4 border-l border-zinc-100">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-xs font-bold text-zinc-900">{user.displayName?.split(' ')[0] || user.email?.split('@')[0]}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={handleSignOut} className="h-8 w-8 text-zinc-400 hover:text-primary hover:bg-primary/5 rounded-full">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:py-8 space-y-8">
        {/* Welcome Hero Banner - Matching Screenshot */}
        <section className="relative overflow-hidden rounded-[2.5rem] bg-primary p-8 sm:p-12 text-white shadow-2xl shadow-primary/30">
          <div className="relative z-10 max-w-2xl space-y-6">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="bg-white/20 text-white border-none px-4 py-1 text-[10px] font-black uppercase tracking-wider rounded-full backdrop-blur-md">
                Student Dashboard
              </Badge>
              <Badge variant="secondary" className="bg-white/10 text-white/80 border-none px-4 py-1 text-[10px] font-black uppercase tracking-wider rounded-full backdrop-blur-md">
                Section: Badal
              </Badge>
            </div>
            
            <h2 className="text-4xl sm:text-6xl font-black tracking-tight">
              Welcome Back, <span className="opacity-90">{user.displayName?.split(' ')[0] || user.username || 'Student'}</span>
            </h2>
            
            <p className="text-lg text-white/70 font-medium leading-relaxed max-w-lg">
              Access your personalized routines, syllabus, and real-time notices from your form teacher.
            </p>
          </div>
          
          {/* Decorative Elements */}
          <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute -top-12 -left-12 h-64 w-64 rounded-full bg-white/10 blur-2xl opacity-50" />
        </section>

        {/* Latest Notices - Placeholder to match screenshot layout */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-primary">
            <RefreshCw className="h-5 w-5" />
            <h3 className="text-lg font-black tracking-tight">Latest Notices</h3>
          </div>
          <Card className="border-none bg-zinc-50 border border-zinc-100 shadow-sm rounded-3xl p-8 text-center">
            <p className="text-zinc-400 font-medium text-sm">No recent notices posted.</p>
          </Card>
        </section>

        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <div className="flex items-center gap-2 text-primary mb-6">
              <BookOpen className="h-5 w-5" />
              <h3 className="text-lg font-black tracking-tight">Class Syllabus</h3>
            </div>

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
            <div className="relative group/nav">
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-white/90 shadow-md border border-zinc-200 flex items-center justify-center p-0"
                onClick={() => {
                  if (scrollContainerRef.current) {
                    scrollContainerRef.current.scrollBy({ left: -200, behavior: 'smooth' });
                  }
                }}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              
              <div 
                ref={scrollContainerRef}
                className="w-full overflow-x-auto scrollbar-hide px-12"
              >
                <TabsList className="inline-flex h-10 w-max items-center justify-start gap-2 bg-transparent p-0">
                  {syllabusData.map((subject) => (
                    <TabsTrigger 
                      key={subject.name} 
                      value={subject.name}
                      className="rounded-full border border-zinc-200 bg-white px-5 py-1.5 text-xs font-bold transition-all data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm hover:bg-zinc-50"
                    >
                      {subject.name}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-white/90 shadow-md border border-zinc-200 flex items-center justify-center p-0"
                onClick={() => {
                  if (scrollContainerRef.current) {
                    scrollContainerRef.current.scrollBy({ left: 200, behavior: 'smooth' });
                  }
                }}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
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
                          className="h-full bg-primary transition-all duration-500" 
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
                          className={`group flex items-center justify-between rounded-2xl border p-4 transition-all duration-300 cursor-pointer ${
                            isCompleted 
                              ? 'border-primary/10 bg-primary/5 opacity-70' 
                              : 'border-zinc-100 bg-white shadow-sm hover:shadow-xl hover:shadow-primary/5 hover:border-primary/20'
                          }`}
                          onClick={() => toggleProgress(subject.name, chapter.id)}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black transition-all ${
                              isCompleted ? 'bg-zinc-200 text-zinc-500' : 'bg-primary text-white shadow-lg shadow-primary/20'
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
                              className="h-6 w-6 rounded-lg border-zinc-200 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>

                  {calculateSubjectProgress(subject) === 100 && (
                    <div className="p-6 text-center rounded-3xl bg-primary text-white shadow-xl shadow-primary/20">
                      <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-white" />
                      <h4 className="text-lg font-bold">Subject Mastered!</h4>
                      <p className="text-sm text-white/50">You've finished all chapters for {subject.name}.</p>
                    </div>
                  )}
                </motion.div>
              </TabsContent>
            ))}
          </AnimatePresence>
            </Tabs>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <Card className="border-none bg-white shadow-xl shadow-zinc-200/50 rounded-[2rem] overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2 text-primary/60">
                  <LayoutDashboard className="h-4 w-4" />
                  <CardTitle className="text-xs font-black uppercase tracking-widest">M2 Syllabus Tracker</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100 space-y-3">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-zinc-400 pl-1">
                    <span>Status</span>
                    <span>Live</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative h-12 w-12 flex-shrink-0">
                      <svg className="h-full w-full -rotate-90 transform">
                        <circle
                          cx="24"
                          cy="24"
                          r="20"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="transparent"
                          className="text-zinc-200"
                        />
                        <circle
                          cx="24"
                          cy="24"
                          r="20"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="transparent"
                          strokeDasharray={2 * Math.PI * 20}
                          strokeDashoffset={2 * Math.PI * 20 * (1 - overallProgress / 100)}
                          strokeLinecap="round"
                          className="text-primary transition-all duration-500"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black">
                        {Math.round(overallProgress)}%
                      </div>
                    </div>
                    <div>
                      <h4 className="font-black text-sm text-primary">M2 (Live Tracker)</h4>
                      <p className="text-[10px] font-bold text-zinc-400">Starting April 4, 2026</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <div>
                      <div className="text-2xl font-black text-zinc-900">{Object.values(progress).filter(Boolean).length}</div>
                      <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">Chapters Done</div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-bold text-zinc-900">{syllabusData.length} Subjects</div>
                      <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 italic">"Keep Pushing!"</div>
                    </div>
                  </div>
                  <Progress value={overallProgress} className="h-2 bg-zinc-100" />
                </div>

                <Button className="w-full bg-primary hover:bg-primary/90 text-white font-black rounded-2xl h-12 shadow-lg shadow-primary/20">
                  Launch M2 Syllabus Tracker
                </Button>
              </CardContent>
            </Card>

            <Card className="border-none bg-zinc-900 text-white rounded-[2rem] p-6 space-y-4 overflow-hidden relative">
              <div className="relative z-10">
                <Trophy className="h-8 w-8 text-yellow-500 mb-2" />
                <h4 className="text-xl font-black tracking-tight">Milestone Rank</h4>
                <p className="text-xs text-white/60 font-medium">Top 5% of students in Badal section</p>
              </div>
              <div className="absolute -bottom-4 -right-4 h-24 w-24 bg-white/5 rounded-full blur-xl" />
            </Card>
          </div>
        </div>
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

// Admin Dashboard Component
function AdminDashboard({ user, isAdmin, onBack }: { user: AppUser | null, isAdmin: boolean, onBack: () => void }) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAdminData = async () => {
    if (!isAdmin) return;
    setRefreshing(true);
    try {
      // Fetch all simple users
      const simpleUsersSnap = await getDocs(collection(db, 'simple_users'));
      const simpleUsers = simpleUsersSnap.docs.map(doc => ({
        uid: doc.id,
        username: doc.data().username,
        email: doc.data().email || null,
        isSimple: true
      }));

      // Fetch all progress to find other users and calculate stats
      const progressSnap = await getDocs(collection(db, 'progress'));
      const allProgress = progressSnap.docs.map(doc => doc.data());

      // Get unique uids from progress
      const progressUids = Array.from(new Set(allProgress.map(p => p.uid)));
      
      // Combine and calculate stats
      const userList = progressUids.map(uid => {
        const simpleUser = simpleUsers.find(u => u.uid === uid);
        const userProgress = allProgress.filter(p => p.uid === uid);
        
        // Calculate finished subjects
        let finishedSubjects = 0;
        syllabusData.forEach(subject => {
          const subjectChapters = subject.chapters.map(c => c.id);
          const completedChapters = userProgress
            .filter(p => p.subject === subject.name && p.completed)
            .map(p => p.chapter);
          
          if (subjectChapters.length > 0 && subjectChapters.every(id => completedChapters.includes(id))) {
            finishedSubjects++;
          }
        });

        return {
          uid,
          username: simpleUser?.username || 'Firebase User',
          email: simpleUser?.email || (uid.startsWith('simple_') ? null : 'Auth User'),
          isSimple: !!simpleUser,
          finishedSubjects,
          totalProgress: userProgress.filter(p => p.completed).length
        };
      });

      // Add simple users who might not have progress yet
      simpleUsers.forEach(su => {
        if (!userList.find(u => u.uid === su.uid)) {
          userList.push({
            uid: su.uid,
            username: su.username,
            email: null,
            isSimple: true,
            finishedSubjects: 0,
            totalProgress: 0
          });
        }
      });

      setUsers(userList.sort((a, b) => b.finishedSubjects - a.finishedSubjects));
    } catch (error) {
      console.error("Error fetching admin data:", error);
      toast.error("Failed to fetch admin data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, [isAdmin]);

  const deleteUser = async (uid: string) => {
    if (!window.confirm(`Are you sure you want to delete user ${uid}? This will delete all their progress.`)) return;
    
    try {
      const batch = writeBatch(db);
      
      // Delete progress
      const progressSnap = await getDocs(query(collection(db, 'progress'), where('uid', '==', uid)));
      progressSnap.docs.forEach(doc => batch.delete(doc.ref));
      
      // Delete simple user doc if exists
      if (uid.startsWith('simple_')) {
        batch.delete(doc(db, 'simple_users', uid));
      }
      
      await batch.commit();
      toast.success("User data deleted successfully");
      fetchAdminData();
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error("Failed to delete user");
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 p-4 text-center">
        <Lock className="mb-4 h-12 w-12 text-zinc-300" />
        <h1 className="text-2xl font-bold text-zinc-900">Access Denied</h1>
        <p className="mt-2 text-zinc-500">You do not have permission to view this page.</p>
        <Button onClick={onBack} className="mt-6 bg-zinc-900">Go Back</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-4 font-sans sm:p-8">
      <Toaster position="top-center" />
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-zinc-900">Admin Dashboard</h1>
              <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">User Management & Stats</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchAdminData} 
            disabled={refreshing}
            className="rounded-full border-zinc-200"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <RefreshCw className="h-8 w-8 animate-spin text-zinc-300" />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="col-span-full border-zinc-200 bg-white shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-zinc-400" />
                  <CardTitle className="text-lg font-bold">System Overview</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-8">
                  <div>
                    <div className="text-2xl font-black text-zinc-900">{users.length}</div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Total Users</div>
                  </div>
                  <div>
                    <div className="text-2xl font-black text-zinc-900">
                      {users.filter(u => u.isSimple).length}
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Simple Users</div>
                  </div>
                  <div>
                    <div className="text-2xl font-black text-zinc-900">
                      {users.filter(u => !u.isSimple).length}
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Auth Users</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {users.map((u) => (
              <motion.div key={u.uid} layout>
                <Card className="border-zinc-200 bg-white shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base font-bold truncate max-w-[150px]">
                            {u.username}
                          </CardTitle>
                          <Badge variant={u.isSimple ? "secondary" : "outline"} className="text-[8px] font-black uppercase px-1.5 py-0">
                            {u.isSimple ? "Simple" : "Auth"}
                          </Badge>
                        </div>
                        <p className="text-[10px] font-mono text-zinc-400 truncate max-w-[200px]">
                          ID: {u.uid}
                        </p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-zinc-400 hover:text-destructive hover:bg-destructive/10 rounded-full"
                        onClick={() => deleteUser(u.uid)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-xl bg-zinc-50 p-3">
                        <div className="text-xl font-black text-zinc-900">{u.finishedSubjects}</div>
                        <div className="text-[9px] font-bold uppercase tracking-tighter text-zinc-400">Subjects Done</div>
                      </div>
                      <div className="rounded-xl bg-zinc-50 p-3">
                        <div className="text-xl font-black text-zinc-900">{u.totalProgress}</div>
                        <div className="text-[9px] font-bold uppercase tracking-tighter text-zinc-400">Total Chapters</div>
                      </div>
                    </div>
                    
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                        <span>Overall Completion</span>
                        <span>{Math.round((u.finishedSubjects / syllabusData.length) * 100)}%</span>
                      </div>
                      <Progress value={(u.finishedSubjects / syllabusData.length) * 100} className="h-1.5 bg-zinc-100" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
