import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Flashcard as FlashcardType } from '../types';
import { RefreshCw, Tag, BarChart } from 'lucide-react';

interface FlashcardProps {
  card: FlashcardType;
}

const Flashcard: React.FC<FlashcardProps> = ({ card }) => {
  const [isFlipped, setIsFlipped] = useState(false);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  return (
    <div className="w-full max-w-md h-64 cursor-pointer perspective-1000 group" onClick={handleFlip}>
      <motion.div
        className="relative w-full h-full text-center transition-all duration-500 transform-style-3d shadow-lg rounded-2xl"
        initial={false}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Front Face */}
        <div className="absolute w-full h-full backface-hidden flex flex-col justify-between p-6 bg-white rounded-2xl border border-slate-200">
          <div className="flex justify-between items-start text-xs text-slate-400 font-medium uppercase tracking-wider">
             <div className="flex items-center gap-1">
               <BarChart className="w-3 h-3" />
               {card.difficulty}
             </div>
             <span>Question</span>
          </div>
          
          <div className="flex-grow flex items-center justify-center">
            <h3 className="text-xl font-semibold text-slate-800 leading-snug">
              {card.front}
            </h3>
          </div>

          <div className="flex justify-center mt-2">
            <span className="text-xs text-indigo-500 font-medium flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> Click to flip
            </span>
          </div>
        </div>

        {/* Back Face */}
        <div 
          className="absolute w-full h-full backface-hidden flex flex-col justify-between p-6 bg-indigo-600 rounded-2xl text-white transform rotate-y-180"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <div className="flex justify-between items-start text-xs text-indigo-200 font-medium uppercase tracking-wider">
             <span>Answer</span>
          </div>

          <div className="flex-grow flex items-center justify-center overflow-y-auto custom-scrollbar">
            <p className="text-lg font-medium leading-relaxed">
              {card.back}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 mt-4 justify-center">
             {card.tags.map(tag => (
               <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-500 text-indigo-50 shadow-sm">
                 <Tag className="w-3 h-3 mr-1 opacity-70" />
                 {tag}
               </span>
             ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Flashcard;