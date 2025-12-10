import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, BookOpen, LayoutGrid, ListChecks } from 'lucide-react';
import { StudySet } from '../types';
import Flashcard from '../components/Flashcard';
import Quiz from '../components/Quiz';

interface StudySetPageProps {
  studySet: StudySet;
}

const StudySetPage: React.FC<StudySetPageProps> = ({ studySet }) => {
  const [activeTab, setActiveTab] = useState<'cards' | 'quiz'>('cards');

  return (
    <motion.div 
      key="results"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Summary Section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 mb-8 shadow-sm relative overflow-hidden transition-colors">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 dark:bg-indigo-900/20 rounded-full blur-3xl -mr-32 -mt-32 opacity-50"></div>
        
        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">{studySet.topic}</h2>
              <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400 font-medium">
                <span className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                  <Clock className="w-3.5 h-3.5" /> {studySet.estimated_study_time_minutes} min
                </span>
                <span className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                  <BookOpen className="w-3.5 h-3.5" /> {studySet.flashcards.length} cards
                </span>
              </div>
            </div>
          </div>
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-lg">
            {studySet.summary}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-8 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl w-fit border border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setActiveTab('cards')}
          className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'cards' 
              ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-600' 
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
          }`}
        >
          <LayoutGrid className="w-4 h-4" /> Flashcards
        </button>
        <button
          onClick={() => setActiveTab('quiz')}
          className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'quiz' 
              ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-600' 
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
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
  );
};

export default StudySetPage;