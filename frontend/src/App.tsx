import React, { useState, useEffect } from 'react';
import { generateStudySet, fetchHistory, fetchStudySet, fetchQueueStatus, HistoryItem } from './api/client';
import { StudySet } from './types';
import Flashcard from './components/Flashcard';
import Quiz from './components/Quiz';
import AuthModal from './components/AuthModal';
import { AuthProvider, useAuth } from './context/AuthContext';
import { 
  BrainCircuit, 
  Sparkles, 
  Loader2, 
  BookOpen, 
  Clock, 
  ChevronRight, 
  RotateCcw,
  LayoutGrid,
  ListChecks,
  History,
  Database,
  LogOut,
  LogIn
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Inner component to access AuthContext
const MainApp = () => {
  const [topic, setTopic] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string>('');
  const [studySet, setStudySet] = useState<StudySet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'cards' | 'quiz'>('cards');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [queueStats, setQueueStats] = useState<any>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const { user, isAuthenticated, logout } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      loadHistory();
    } else {
      setHistory([]);
    }
    
    const interval = setInterval(loadQueueStats, 5000);
    loadQueueStats();
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Handle browser back button/swipe navigation
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      // If the user swipes back or clicks back, we reset to the home view.
      // This works because we push a state when a study set is loaded.
      setStudySet(null);
      setTopic('');
      setError(null);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const loadHistory = async () => {
    try {
      const data = await fetchHistory();
      setHistory(data);
    } catch (e) {
      console.error("Failed to load history", e);
    }
  };

  const loadQueueStats = async () => {
    try {
      const stats = await fetchQueueStatus();
      setQueueStats(stats);
    } catch (e) {
      console.error("Failed to load stats", e);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setIsLoading(true);
    setLoadingStatus('initiating');
    setError(null);
    setStudySet(null);
    setActiveTab('cards');

    try {
      const data = await generateStudySet(topic, (status) => {
        setLoadingStatus(status);
      });
      setStudySet(data);
      // Push state to history so "Back" works
      window.history.pushState({ view: 'results' }, '', '#results');
      
      if (isAuthenticated) {
        loadHistory(); // Refresh history if logged in
      }
    } catch (err: any) {
      setError(err.message || "Failed to generate content. Please try again.");
    } finally {
      setIsLoading(false);
      setLoadingStatus('');
    }
  };

  const loadSetFromHistory = async (id: number) => {
    setIsLoading(true);
    setLoadingStatus('loading_history');
    setStudySet(null);
    try {
      const data = await fetchStudySet(id);
      setStudySet(data);
      // Push state to history so "Back" works
      window.history.pushState({ view: 'results' }, '', '#results');
    } catch (err) {
      setError("Could not load this study set.");
    } finally {
      setIsLoading(false);
      setLoadingStatus('');
    }
  };

  const resetApp = () => {
    if (studySet) {
      // If we are currently viewing a set, "Reset" acts like "Back"
      // This triggers the popstate event listener above which clears the state
      window.history.back();
    } else {
      setTopic('');
      setStudySet(null);
      setError(null);
      if (isAuthenticated) loadHistory();
    }
  };

  const getLoadingMessage = () => {
    switch (loadingStatus) {
      case 'queued': return 'Waiting in queue...';
      case 'processing': return 'AI is generating content...';
      case 'loading_history': return 'Loading from database...';
      case 'initiating': return 'Contacting server...';
      default: return 'Generating your study plan...';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div 
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity" 
            onClick={resetApp}
          >
            <div className="bg-indigo-600 p-1.5 rounded-lg shadow-sm shadow-indigo-200">
              <BrainCircuit className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-800">FlashMind AI</span>
          </div>
          
          <div className="flex items-center gap-4">
             {/* Redis/Queue Indicator */}
             {queueStats && (
               <div className="hidden md:flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-100 px-2 py-1 rounded">
                  <Database className="w-3 h-3" />
                  <span>Q: {queueStats.active} act / {queueStats.waiting} wait</span>
               </div>
             )}

             {studySet && (
               <button 
                 onClick={resetApp}
                 className="hidden sm:flex text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors items-center gap-1"
               >
                 <RotateCcw className="w-4 h-4" /> New Topic
               </button>
             )}

             {isAuthenticated ? (
               <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
                 {/* Avatar Section */}
                 <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-sm shadow-sm">
                     {user?.name ? user.name.charAt(0).toUpperCase() : (user?.email?.charAt(0).toUpperCase() || 'U')}
                   </div>
                   <div className="text-right hidden sm:block">
                     <p className="text-xs font-bold text-slate-900">{user?.name || 'User'}</p>
                     <p className="text-[10px] text-slate-500 font-medium">Free Plan</p>
                   </div>
                 </div>
                 
                 <button 
                   onClick={logout}
                   className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors ml-1"
                   title="Logout"
                 >
                   <LogOut className="w-5 h-5" />
                 </button>
               </div>
             ) : (
               <button
                 onClick={() => setIsAuthModalOpen(true)}
                 className="flex items-center gap-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 rounded-full transition-all shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30 active:scale-95"
               >
                 <LogIn className="w-4 h-4" /> Sign In
               </button>
             )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        
        <AnimatePresence mode="wait">
          {!studySet && !isLoading && (
            <motion.div 
              key="hero"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl mx-auto text-center mt-8 sm:mt-16"
            >
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-sm font-medium mb-6 ring-1 ring-indigo-100">
                <Sparkles className="w-4 h-4 mr-2" />
                Powered by Gemini 2.5 + Redis
              </div>
              <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-6 leading-tight">
                Turn any topic into <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">
                  mastery in seconds.
                </span>
              </h1>
              
              {!isAuthenticated && (
                 <p className="text-sm text-amber-700 bg-amber-50 inline-block px-4 py-1.5 rounded-full mb-8 border border-amber-200/60 font-medium">
                   ✨ Log in to save your study sets and track progress.
                 </p>
              )}

              <form onSubmit={handleGenerate} className="relative max-w-lg mx-auto mb-16 group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-2xl opacity-20 group-hover:opacity-40 transition duration-300 blur"></div>
                <div className="relative">
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="What do you want to learn? (e.g. 'Photosynthesis', 'React Hooks')"
                    className="w-full px-6 py-4 rounded-2xl bg-white border-2 border-slate-100 shadow-xl shadow-slate-200/40 text-lg focus:outline-none focus:border-indigo-500 focus:ring-0 transition-all placeholder:text-slate-400 text-slate-800"
                    disabled={isLoading}
                  />
                  <button
                    type="submit"
                    disabled={!topic.trim() || isLoading}
                    className="absolute right-2 top-2 bottom-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl px-4 font-medium transition-colors flex items-center justify-center w-12"
                  >
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ChevronRight className="w-6 h-6" />}
                  </button>
                </div>
              </form>
              
              {/* History Section - Only Visible if Logged In */}
              {isAuthenticated && history.length > 0 ? (
                <div className="text-left max-w-lg mx-auto">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <History className="w-4 h-4" /> Recent Activity
                  </h3>
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
                    {history.map((item) => (
                      <div 
                        key={item.id}
                        onClick={() => loadSetFromHistory(item.id)}
                        className="p-4 hover:bg-slate-50 transition-colors cursor-pointer group flex items-center justify-between"
                      >
                         <div>
                           <div className="font-medium text-slate-800 group-hover:text-indigo-600 transition-colors">
                             {item.topic}
                           </div>
                           <div className="text-xs text-slate-500 mt-1 line-clamp-1">
                             {item.summary.substring(0, 60)}...
                           </div>
                         </div>
                         <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 transition-colors" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : isAuthenticated && history.length === 0 ? (
                <div className="text-slate-400 text-sm italic">
                  Start learning to build your history!
                </div>
              ) : null}

              {error && (
                <div className="mt-6 p-4 bg-red-50 text-red-700 rounded-xl text-sm font-medium border border-red-100 shadow-sm">
                  {error}
                </div>
              )}
            </motion.div>
          )}

          {isLoading && (
            <motion.div 
              key="loader"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center mt-32"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-20 animate-pulse rounded-full"></div>
                <Loader2 className="relative w-12 h-12 text-indigo-600 animate-spin mb-4" />
              </div>
              <p className="text-lg font-medium text-slate-600">{getLoadingMessage()}</p>
            </motion.div>
          )}

          {studySet && (
            <motion.div 
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              {/* Summary Section */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 mb-8 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl -mr-32 -mt-32 opacity-50"></div>
                
                <div className="relative z-10">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
                    <div>
                      <h2 className="text-3xl font-bold text-slate-900 mb-2">{studySet.topic}</h2>
                      <div className="flex items-center gap-4 text-sm text-slate-500 font-medium">
                        <span className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-md">
                          <Clock className="w-3.5 h-3.5" /> {studySet.estimated_study_time_minutes} min
                        </span>
                        <span className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-md">
                          <BookOpen className="w-3.5 h-3.5" /> {studySet.flashcards.length} cards
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-slate-700 leading-relaxed text-lg">
                    {studySet.summary}
                  </p>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-2 mb-8 bg-slate-100 p-1.5 rounded-xl w-fit border border-slate-200">
                <button
                  onClick={() => setActiveTab('cards')}
                  className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                    activeTab === 'cards' 
                      ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200' 
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" /> Flashcards
                </button>
                <button
                  onClick={() => setActiveTab('quiz')}
                  className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                    activeTab === 'quiz' 
                      ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200' 
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <ListChecks className="w-4 h-4" /> Practice Quiz
                </button>
              </div>

              {/* Content Area */}
              <div className="min-h-[400px]">
                {activeTab === 'cards' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 justify-items-center">
                    {studySet.flashcards.map((card) => (
                      <Flashcard key={card.id} card={card} />
                    ))}
                  </div>
                ) : (
                  <Quiz questions={studySet.example_quiz_questions} />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

// Root wrapper to provide Context
function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

export default App;