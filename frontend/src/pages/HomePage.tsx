import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Loader2, ChevronRight, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchHistory, generateStudySet, HistoryItem } from '../api/client';
import { useAuth } from '../context/AuthContext';
import LoadingView from '../components/LoadingView';

interface HomePageProps {
  onOpenAuth: () => void;
}

const HomePage: React.FC<HomePageProps> = ({ onOpenAuth }) => {
  const [topic, setTopic] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      loadHistory();
    } else {
      setHistory([]);
    }
  }, [isAuthenticated]);

  const loadHistory = async () => {
    try {
      const data = await fetchHistory();
      setHistory(data);
    } catch (e) {
      console.error("Failed to load history", e);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setIsLoading(true);
    setLoadingStatus('initiating');
    setError(null);

    try {
      const data = await generateStudySet(topic, (status) => {
        setLoadingStatus(status);
      });
      
      // Navigate to the result page. 
      // If the backend returns an ID, we use it in the URL.
      // We also pass the data in state to avoid re-fetching immediately.
      if (data.id) {
        navigate(`/set/${data.id}`, { state: { studySet: data } });
      } else {
        // Fallback if no ID is present (rare/error case)
        setError("Generated set is missing an ID.");
      }
      
    } catch (err: any) {
      setError(err.message || "Failed to generate content. Please try again.");
    } finally {
      setIsLoading(false);
      setLoadingStatus('');
    }
  };

  if (isLoading) {
    return <LoadingView status={loadingStatus} />;
  }

  return (
    <motion.div 
      key="hero"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-2xl mx-auto text-center mt-8 sm:mt-16"
    >
      <div className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-sm font-medium mb-6 ring-1 ring-indigo-100 dark:ring-indigo-800">
        <Sparkles className="w-4 h-4 mr-2" />
        Powered by Gemini 2.5 
      </div>
      <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-6 leading-tight">
        Turn any topic into <br/>
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400">
          mastery in seconds.
        </span>
      </h1>
      
      {!isAuthenticated && (
          <p 
            onClick={onOpenAuth}
            className="text-sm cursor-pointer hover:underline text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 inline-block px-4 py-1.5 rounded-full mb-8 border border-amber-200/60 dark:border-amber-800/60 font-medium"
          >
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
            className="w-full px-6 py-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-slate-900/50 text-lg focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-0 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 text-slate-800 dark:text-slate-100"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!topic.trim() || isLoading}
            className="absolute right-2 top-2 bottom-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 text-white rounded-xl px-4 font-medium transition-colors flex items-center justify-center w-12"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ChevronRight className="w-6 h-6" />}
          </button>
        </div>
      </form>
      
      {/* History Section */}
      {isAuthenticated && history.length > 0 ? (
        <div className="text-left max-w-lg mx-auto">
          <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <History className="w-4 h-4" /> Recent Activity
          </h3>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
            {history.map((item) => (
              <div 
                key={item.id}
                onClick={() => navigate(`/set/${item.id}`)}
                className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group flex items-center justify-between"
              >
                  <div>
                    <div className="font-medium text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {item.topic}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                      {item.summary.substring(0, 60)}...
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-indigo-400 transition-colors" />
              </div>
            ))}
          </div>
        </div>
      ) : isAuthenticated && history.length === 0 ? (
        <div className="text-slate-400 dark:text-slate-500 text-sm italic">
          Start learning to build your history!
        </div>
      ) : null}

      {error && (
        <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl text-sm font-medium border border-red-100 dark:border-red-900/30 shadow-sm">
          {error}
        </div>
      )}
    </motion.div>
  );
};

export default HomePage;