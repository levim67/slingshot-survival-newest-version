import React, { useEffect, useState } from 'react';
import { Coins, Zap, Play, Menu as MenuIcon } from 'lucide-react';
import * as audio from '../../utils/audio';

interface ResultsScreenProps {
  score: number;
  earnedCoins: number;
  totalCoins: number;
  onInstantReplay: () => void;
  onMenu: () => void;
}

const ResultsScreen: React.FC<ResultsScreenProps> = ({ 
  score, 
  earnedCoins, 
  totalCoins, // This should be total coins BEFORE this run for the animation to look right, but current flow updates it before this screen. We will visually handle it.
  onInstantReplay, 
  onMenu 
}) => {
  const [displayScore, setDisplayScore] = useState(score);
  const [displayEarned, setDisplayEarned] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    // Wait a moment before starting animation
    const startDelay = setTimeout(() => {
        const duration = 2000; // 2 seconds to drain score
        const steps = 60;
        const intervalTime = duration / steps;
        const scoreStep = score / steps;
        const coinStep = earnedCoins / steps;
        
        let currentStep = 0;
        
        const timer = setInterval(() => {
            currentStep++;
            const pct = Math.min(1, currentStep / steps);
            
            // Visual Updates
            setDisplayScore(Math.max(0, Math.floor(score * (1 - pct))));
            setDisplayEarned(Math.min(earnedCoins, Math.floor(earnedCoins * pct)));
            setProgress(pct * 100);

            // Sound
            if (currentStep % 5 === 0) {
                 audio.playSFX('collect', 0.2);
            }

            if (currentStep >= steps) {
                clearInterval(timer);
                setIsFinished(true);
                audio.playSFX('charge', 1.0); // Success sound at end
            }
        }, intervalTime);

        return () => clearInterval(timer);
    }, 500);

    return () => clearTimeout(startDelay);
  }, [score, earnedCoins]);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 z-40 backdrop-blur-md font-sans">
      
      {/* Title */}
      <h2 className="text-4xl font-black text-white italic tracking-widest mb-12 uppercase drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">
         Session Complete
      </h2>

      {/* CONVERSION ANIMATION AREA */}
      <div className="w-full max-w-sm px-8 flex flex-col gap-6 mb-12">
          
          {/* Score Row */}
          <div className="flex justify-between items-end text-white/80">
              <span className="text-sm font-bold tracking-widest uppercase">Score</span>
              <span className={`text-3xl font-mono font-bold transition-colors ${displayScore === 0 ? 'text-white/20' : 'text-cyan-400'}`}>
                  {displayScore.toLocaleString()}
              </span>
          </div>

          {/* Progress Bar (XP -> Coins) */}
          <div className="relative h-6 bg-slate-800 rounded-full overflow-hidden shadow-inner border border-white/10">
              {/* Fill */}
              <div 
                  className="absolute top-0 left-0 h-full bg-yellow-400 transition-all duration-75 ease-linear shadow-[0_0_20px_#facc15]"
                  style={{ width: `${progress}%` }}
              >
                  {/* Glare */}
                  <div className="absolute top-0 right-0 w-[50px] h-full bg-white/50 blur-md transform translate-x-1/2"></div>
              </div>
          </div>

          {/* Coins Row */}
          <div className="flex justify-between items-center">
              <div className="flex flex-col">
                  <span className="text-sm font-bold tracking-widest uppercase text-yellow-500">Coins Earned</span>
              </div>
              <div className="flex items-center gap-2">
                  <span className="text-4xl font-black text-yellow-400 drop-shadow-md">
                      +{displayEarned}
                  </span>
                  <Coins size={32} className="text-yellow-400 animate-bounce" />
              </div>
          </div>

      </div>

      {/* ACTIONS (Only show when finished) */}
      <div className={`flex flex-col gap-4 transition-all duration-500 ${isFinished ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}>
          
          <button 
              onClick={onInstantReplay}
              className="bg-white text-black font-black text-2xl py-4 px-12 rounded-full uppercase hover:scale-105 active:scale-95 transition-transform shadow-[0_0_30px_rgba(255,255,255,0.4)] flex items-center justify-center gap-3"
          >
              <Play fill="black" /> Play Again
          </button>

          <button 
              onClick={onMenu}
              className="bg-transparent border-2 border-white/30 text-white font-bold text-xl py-3 px-12 rounded-full uppercase hover:bg-white hover:text-black transition-all flex items-center justify-center gap-3"
          >
              <MenuIcon /> Menu & Shop
          </button>

      </div>

    </div>
  );
};

export default ResultsScreen;