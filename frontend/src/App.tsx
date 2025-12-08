import React, { useState } from 'react';
import { generateStudySet } from './api/client';
import { StudySet } from './types';
import Flashcard from './components/Flashcard';
import Quiz from './components/Quiz';
import { 
  BrainCircuit, 
  Sparkles, 
  Loader2, 
  BookOpen, 
  Clock, 
  ChevronRight, 
  RotateCcw,
  LayoutGrid,
  ListChecks
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function App() {
  const [topic, setTopic] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [studySet, setStudySet] = useState<StudySet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'cards' | 'quiz'>('cards');

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setIsLoading(true);
    setError(null);
    setStudySet(null);
    setActiveTab('cards');

    try {
      const data = await generateStudySet(topic);
      setStudySet(data);
    } catch (err: any) {
      setError(err.message || "Failed to generate content. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const resetApp = () => {
    setTopic('');
    setStudySet(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div 
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity" 
            onClick={resetApp}
          >
            <div className="bg-indigo-600 p-1.5 rounded-lg">
              <BrainCircuit className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-800">FlashMind AI</span>
          </div>
          {studySet && (
             <button 
               onClick={resetApp}
               className="text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors flex items-center gap-1"
             >
               <RotateCcw className="w-4 h-4" /> New Topic
             </button>
          )}
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
              className="max-w-2xl mx-auto text-center mt-12 sm:mt-20"
            >
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-sm font-medium mb-6">
                <Sparkles className="w-4 h-4 mr-2" />
                Powered by Gemini 2.5
              </div>
              <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-6 leading-tight">
                Turn any topic into <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">
                  mastery in seconds.
                </span>
              </h1>
              <p className="text-lg text-slate-600 mb-10 max-w-lg mx-auto leading-relaxed">
                Enter a subject, and our AI will instantly craft a comprehensive study set with flashcards and quizzes tailored just for you.
              </p>

              <form onSubmit={handleGenerate} className="relative max-w-lg mx-auto">
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="What do you want to learn? (e.g. 'Photosynthesis', 'React Hooks')"
                  className="w-full px-6 py-4 rounded-2xl bg-white border-2 border-slate-200 shadow-sm text-lg focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-400"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={!topic.trim() || isLoading}
                  className="absolute right-2 top-2 bottom-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl px-6 font-medium transition-colors flex items-center"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ChevronRight className="w-5 h-5" />}
                </button>
              </form>
              
              {error && (
                <div className="mt-6 p-4 bg-red-50 text-red-700 rounded-xl text-sm font-medium border border-red-100">
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
              <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
              <p className="text-lg font-medium text-slate-600">Generating your study plan...</p>
              <p className="text-sm text-slate-400 mt-2">Crafting flashcards • Designing quiz • Summarizing concepts</p>
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
              <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 mb-8 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-3xl font-bold text-slate-900 mb-2">{studySet.topic}</h2>
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4" /> {studySet.estimated_study_time_minutes} min study time
                      </span>
                      <span className="flex items-center gap-1.5">
                        <BookOpen className="w-4 h-4" /> {studySet.flashcards.length} cards
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-slate-700 leading-relaxed text-lg">
                  {studySet.summary}
                </p>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-2 mb-8 bg-slate-100/50 p-1 rounded-xl w-fit">
                <button
                  onClick={() => setActiveTab('cards')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                    activeTab === 'cards' 
                      ? 'bg-white text-indigo-600 shadow-sm' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" /> Flashcards
                </button>
                <button
                  onClick={() => setActiveTab('quiz')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                    activeTab === 'quiz' 
                      ? 'bg-white text-indigo-600 shadow-sm' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
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
}

export default App;