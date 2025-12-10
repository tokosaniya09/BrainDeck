import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';

import { generateStudySet, fetchHistory, fetchStudySet, fetchQueueStatus, HistoryItem } from './api/client';
import { StudySet } from './types';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

import AuthModal from './components/AuthModal';
import Header from './components/Header';
import LoadingView from './components/LoadingView';
import HomePage from './pages/HomePage';
import StudySetPage from './pages/StudySetPage';

const MainApp = () => {
  const [topic, setTopic] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string>('');
  const [studySet, setStudySet] = useState<StudySet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [queueStats, setQueueStats] = useState<any>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const { isAuthenticated } = useAuth();

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
    const handlePopState = () => {
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

    try {
      const data = await generateStudySet(topic, (status) => {
        setLoadingStatus(status);
      });
      setStudySet(data);
      // Push state to history so "Back" works
      window.history.pushState({ view: 'results' }, '', '#results');
      
      if (isAuthenticated) {
        loadHistory(); 
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
      window.history.back();
    } else {
      setTopic('');
      setStudySet(null);
      setError(null);
      if (isAuthenticated) loadHistory();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-20 transition-colors duration-300">
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

      <Header 
        queueStats={queueStats} 
        studySet={studySet} 
        onReset={resetApp} 
        onOpenAuth={() => setIsAuthModalOpen(true)} 
      />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <AnimatePresence mode="wait">
          
          {!studySet && !isLoading && (
            <HomePage 
              topic={topic}
              setTopic={setTopic}
              isLoading={isLoading}
              onGenerate={handleGenerate}
              history={history}
              onLoadHistoryItem={loadSetFromHistory}
              error={error}
              isAuthenticated={isAuthenticated}
            />
          )}

          {isLoading && (
            <LoadingView status={loadingStatus} />
          )}

          {studySet && (
            <StudySetPage studySet={studySet} />
          )}

        </AnimatePresence>
      </main>
    </div>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;