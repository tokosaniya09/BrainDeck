import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';

import { fetchQueueStatus } from './api/client';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

import AuthModal from './components/AuthModal';
import Header from './components/Header';
import HomePage from './pages/HomePage';
import StudySetPage from './pages/StudySetPage';

const MainLayout = () => {
  const [queueStats, setQueueStats] = useState<any>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const interval = setInterval(loadQueueStats, 5000);
    loadQueueStats();
    return () => clearInterval(interval);
  }, []);

  const loadQueueStats = async () => {
    try {
      const stats = await fetchQueueStatus();
      setQueueStats(stats);
    } catch (e) {
      console.error("Failed to load stats", e);
    }
  };

  const resetApp = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-20 transition-colors duration-300">
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

      {/* Header no longer accepts 'studySet' prop */}
      <Header 
        queueStats={queueStats} 
        onReset={resetApp} 
        onOpenAuth={() => setIsAuthModalOpen(true)} 
      />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
         <Routes>
           {/* HomePage no longer accepts 'topic', 'setTopic', 'history' etc. */}
           <Route 
             path="/" 
             element={<HomePage onOpenAuth={() => setIsAuthModalOpen(true)} />} 
           />
           <Route 
             path="/set/:id" 
             element={<StudySetPage />} 
           />
           {/* Fallback route */}
           <Route path="*" element={<HomePage onOpenAuth={() => setIsAuthModalOpen(true)} />} />
         </Routes>
      </main>
    </div>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MainLayout />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;