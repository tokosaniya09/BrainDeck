import React from 'react';
import { BrainCircuit, RotateCcw, Database, LogOut, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { StudySet } from '../types';

interface HeaderProps {
  queueStats: any;
  studySet: StudySet | null;
  onReset: () => void;
  onOpenAuth: () => void;
}

const Header: React.FC<HeaderProps> = ({ queueStats, studySet, onReset, onOpenAuth }) => {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div 
          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity" 
          onClick={onReset}
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
               onClick={onReset}
               className="hidden sm:flex text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors items-center gap-1"
             >
               <RotateCcw className="w-4 h-4" /> New Topic
             </button>
           )}

           {isAuthenticated ? (
             <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
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
               onClick={onOpenAuth}
               className="flex items-center gap-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 rounded-full transition-all shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30 active:scale-95"
             >
               <LogIn className="w-4 h-4" /> Sign In
             </button>
           )}
        </div>
      </div>
    </header>
  );
};

export default Header;