import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Loader2, ChevronRight, History, Paperclip, X, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchHistory, generateStudySet, uploadFileAndGenerate, HistoryItem } from '../api/client';
import { useAuth } from '../context/AuthContext';
import LoadingView from '../components/LoadingView';

interface HomePageProps {
  onOpenAuth: () => void;
}

const HomePage: React.FC<HomePageProps> = ({ onOpenAuth }) => {
  const [topic, setTopic] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        setError("File size must be under 5MB.");
        return;
      }
      setSelectedFile(file);
      setTopic(''); // Clear topic if file is selected
      setError(null);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() && !selectedFile) return;

    setIsLoading(true);
    setLoadingStatus('initiating');
    setError(null);

    try {
      let data;
      
      if (selectedFile) {
        // File Upload Flow
        data = await uploadFileAndGenerate(selectedFile, (status) => {
          setLoadingStatus(status);
        });
      } else {
        // Topic Flow
        data = await generateStudySet(topic, (status) => {
          setLoadingStatus(status);
        });
      }
      
      if (data.id) {
        navigate(`/set/${data.id}`, { state: { studySet: data } });
      } else {
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
        Powered by Gemini 2.5 + Redis
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

      <form onSubmit={handleGenerate} className="relative max-w-lg mx-auto mb-16 group z-10">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-2xl opacity-20 group-hover:opacity-40 transition duration-300 blur"></div>
        <div className="relative flex items-center bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-200/40 dark:shadow-slate-900/50 border-2 border-slate-100 dark:border-slate-800">
          
          {/* File Input Logic */}
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".pdf,.txt"
            className="hidden"
          />

          <AnimatePresence mode="wait">
            {selectedFile ? (
              <motion.div 
                key="file-selected"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex-grow flex items-center gap-3 px-4 py-3"
              >
                <div className="bg-indigo-100 dark:bg-indigo-900/40 p-2 rounded-lg">
                  <FileText className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="flex-grow text-left">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[200px]">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {(selectedFile.size / 1024).toFixed(0)} KB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearFile}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </motion.div>
            ) : (
              <motion.div 
                key="text-input"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-grow"
              >
                 <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Enter a topic..."
                    className="w-full h-full px-6 py-4 bg-transparent focus:outline-none text-lg placeholder:text-slate-400 dark:placeholder:text-slate-600 text-slate-800 dark:text-slate-100"
                    disabled={isLoading}
                  />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-2 pr-2">
            {!selectedFile && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-colors"
                title="Upload PDF or Text file"
              >
                <Paperclip className="w-5 h-5" />
              </button>
            )}
            
            <button
              type="submit"
              disabled={(!topic.trim() && !selectedFile) || isLoading}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 text-white rounded-xl px-4 py-2 font-medium transition-colors flex items-center justify-center h-10"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ChevronRight className="w-6 h-6" />}
            </button>
          </div>
        </div>
        {!selectedFile && <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">Or click the paperclip to upload a PDF/TXT</p>}
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