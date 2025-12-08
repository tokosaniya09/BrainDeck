import React, { useState } from 'react';
import { QuizQuestion } from '../types';
import { CheckCircle2, XCircle, HelpCircle } from 'lucide-react';
import { clsx } from 'clsx';

interface QuizProps {
  questions: QuizQuestion[];
}

const Quiz: React.FC<QuizProps> = ({ questions }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [showResults, setShowResults] = useState(false);

  const currentQuestion = questions[currentQuestionIndex];

  const handleChoiceClick = (index: number) => {
    if (isAnswered) return;
    setSelectedChoice(index);
    setIsAnswered(true);

    if (index === currentQuestion.answer_index) {
      setScore(s => s + 1);
    }
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedChoice(null);
      setIsAnswered(false);
    } else {
      setShowResults(true);
    }
  };

  const resetQuiz = () => {
    setCurrentQuestionIndex(0);
    setSelectedChoice(null);
    setIsAnswered(false);
    setScore(0);
    setShowResults(false);
  };

  if (showResults) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center max-w-md mx-auto">
        <div className="mb-4 flex justify-center text-indigo-600">
           <CheckCircle2 className="w-16 h-16" />
        </div>
        <h3 className="text-2xl font-bold text-slate-800 mb-2">Quiz Completed!</h3>
        <p className="text-slate-600 mb-6">You scored <span className="font-bold text-indigo-600">{score}</span> out of <span className="font-bold">{questions.length}</span></p>
        <button 
          onClick={resetQuiz}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-indigo-500" />
          Quiz Check
        </h3>
        <span className="text-sm font-medium text-slate-500">
          Question {currentQuestionIndex + 1} of {questions.length}
        </span>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <p className="text-lg text-slate-800 font-medium mb-6">
          {currentQuestion.question}
        </p>

        <div className="space-y-3">
          {currentQuestion.choices.map((choice, index) => {
            const isSelected = selectedChoice === index;
            const isCorrect = index === currentQuestion.answer_index;
            const showCorrect = isAnswered && isCorrect;
            const showIncorrect = isAnswered && isSelected && !isCorrect;

            return (
              <button
                key={index}
                onClick={() => handleChoiceClick(index)}
                disabled={isAnswered}
                className={clsx(
                  "w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-center justify-between group",
                  !isAnswered && "hover:border-indigo-300 hover:bg-indigo-50 border-slate-200",
                  showCorrect && "bg-green-50 border-green-500 ring-1 ring-green-500",
                  showIncorrect && "bg-red-50 border-red-300",
                  isAnswered && !showCorrect && !showIncorrect && "opacity-50 border-slate-200"
                )}
              >
                <span className={clsx(
                  "font-medium",
                  showCorrect ? "text-green-800" : showIncorrect ? "text-red-800" : "text-slate-700"
                )}>
                  {choice}
                </span>
                
                {showCorrect && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                {showIncorrect && <XCircle className="w-5 h-5 text-red-500" />}
              </button>
            );
          })}
        </div>

        {isAnswered && (
          <div className="mt-6 flex justify-end">
            <button
              onClick={nextQuestion}
              className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors font-medium flex items-center gap-2"
            >
              {currentQuestionIndex < questions.length - 1 ? "Next Question" : "Finish Quiz"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Quiz;