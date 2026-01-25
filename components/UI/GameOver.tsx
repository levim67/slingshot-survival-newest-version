import React from 'react';

interface GameOverProps {
  score: number;
  highScore: number;
  distance: number;
  bestDistance: number;
  totalCoins: number;
  earnedCoins: number;
  onRestart: () => void;
  onShop: () => void;
}

const GameOver: React.FC<GameOverProps> = ({ 
  score, 
  highScore, 
  distance, 
  bestDistance, 
  totalCoins, 
  earnedCoins,
  onRestart, 
  onShop 
}) => {

  // Progress Bar Calculation
  // We want to show a bar from 0 to slightly more than the best distance
  // If current distance is a new record, the "best" marker is the same as "you".
  const maxDisplay = Math.max(bestDistance, distance, 100) * 1.2; 
  const startPercent = 0;
  const currentPercent = (distance / maxDisplay) * 100;
  const bestPercent = (bestDistance / maxDisplay) * 100;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 z-20 backdrop-blur-md font-sans">
      
      {/* --- TOP SECTION: SCORES --- */}
      <div className="flex flex-col items-center mb-8 gap-2">
          <h1 className="text-5xl font-black text-white tracking-wider" style={{ textShadow: '0 0 15px rgba(255,255,255,0.6)' }}>
            SCORE: {score}
          </h1>
          <h2 className="text-2xl font-bold text-yellow-400 tracking-wide" style={{ textShadow: '0 0 10px rgba(250,204,21,0.5)' }}>
            HIGHSCORE: {highScore}
          </h2>
      </div>

      {/* --- STATS GRID (Small breakdown) --- */}
      <div className="grid grid-cols-2 gap-x-12 gap-y-1 text-slate-400 text-sm font-mono mb-8 opacity-80">
          <div className="text-right">Distance:</div>
          <div className="text-white font-bold">{distance}m</div>
          
          <div className="text-right">Coins:</div>
          <div className="text-white font-bold">+{earnedCoins}</div>

          <div className="text-right">New Best:</div>
          <div className="text-white font-bold">{distance >= bestDistance && distance > 0 ? "YES" : "NO"}</div>
      </div>

      {/* --- PROGRESS BAR --- */}
      <div className="w-full max-w-lg h-32 relative flex items-center justify-center mb-6">
          {/* Main Line */}
          <div className="w-full h-1 bg-white/30 rounded-full relative">
              <div className="absolute top-0 left-0 h-full bg-white rounded-full shadow-[0_0_10px_white]" style={{ width: '100%' }}></div>
          </div>

          {/* Start Marker */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 flex flex-col items-center group">
              <div className="w-1 h-6 bg-white shadow-[0_0_5px_white]"></div>
              <span className="text-xs font-bold text-white mt-2 tracking-widest uppercase opacity-80">Start</span>
          </div>

          {/* Best Marker (If distinct from current) */}
          {Math.abs(currentPercent - bestPercent) > 5 && (
             <div className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center transition-all duration-1000" style={{ left: `${bestPercent}%` }}>
                 <div className="w-1 h-8 bg-yellow-400 shadow-[0_0_10px_yellow]"></div>
                 <span className="text-xs font-bold text-yellow-400 mt-2 tracking-widest uppercase">Best</span>
             </div>
          )}

          {/* You Marker */}
          <div className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center z-10 transition-all duration-1000" style={{ left: `${currentPercent}%` }}>
               {/* Label above */}
               <span className="text-sm font-black text-cyan-400 mb-2 italic tracking-wider shadow-black drop-shadow-md">You</span>
               <div className="w-1.5 h-10 bg-cyan-400 shadow-[0_0_15px_cyan]"></div>
          </div>
          
           {/* End/Goal Marker (Visual only) */}
           <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col items-center opacity-50">
              <div className="w-1 h-4 bg-white"></div>
              <span className="text-xs font-bold text-white mt-2 tracking-widest">??</span>
          </div>
      </div>

      {/* --- TOTAL MONEY --- */}
      <div className="text-4xl font-black text-yellow-400 mb-8 tracking-widest drop-shadow-[0_2px_0_rgba(0,0,0,1)]">
        ${totalCoins.toLocaleString()}
      </div>

      {/* --- BUTTONS --- */}
      <div className="flex flex-col gap-4 w-64 z-20">
        <button 
          onClick={onRestart}
          className="bg-white text-black font-black text-3xl py-3 px-8 uppercase hover:scale-105 active:scale-95 transition-transform shadow-[0_0_20px_rgba(255,255,255,0.4)]"
        >
          PLAY
        </button>
        <button 
          onClick={onShop}
          className="bg-transparent border-4 border-white text-white font-bold text-2xl py-2 px-8 uppercase hover:bg-white hover:text-black transition-all"
        >
          SHOP
        </button>
      </div>

      {/* --- ADS BUTTON (Visual) --- */}
      <div className="absolute right-8 bottom-1/3 translate-y-1/2 flex flex-col items-center cursor-pointer group animate-pulse hover:animate-none">
          <div className="bg-white text-black font-black text-lg px-4 py-2 uppercase shadow-lg group-hover:scale-105 transition-transform">
              WATCH AD
          </div>
          <div className="text-white font-bold mt-2 text-xl drop-shadow-md">
              + $500
          </div>
      </div>

    </div>
  );
};

export default GameOver;