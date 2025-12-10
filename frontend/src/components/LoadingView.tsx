import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

interface LoadingViewProps {
  status: string;
}

const LoadingView: React.FC<LoadingViewProps> = ({ status }) => {
  const getLoadingMessage = () => {
    switch (status) {
      case 'queued': return 'Waiting in queue...';
      case 'processing': return 'AI is generating content...';
      case 'loading_history': return 'Loading from database...';
      case 'initiating': return 'Contacting server...';
      default: return 'Generating your study plan...';
    }
  };

  return (
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
  );
};

export default LoadingView;