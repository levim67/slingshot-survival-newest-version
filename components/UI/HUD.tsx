
import React, { useEffect, useState } from 'react';
import { Shield, Clock, Pause } from 'lucide-react';
import * as audio from '../../utils/audio';

interface HUDProps {
  health: number;
  maxHealth: number;
  score: number;
  distance: number;
  multiplier: number;
  autoBounceUnlocked: boolean;
  cooldownRemaining: number; 
  isActive: boolean;
  onActivateAutoBounce: () => void;
  timeAlive: number; 
  bossHealth: number;
  maxBossHealth: number;
  onPause: () => void;
}

const HUD: React.FC<HUDProps> = ({ 
    health, maxHealth, score, distance, multiplier, 
    autoBounceUnlocked, cooldownRemaining, isActive, onActivateAutoBounce,
    timeAlive, bossHealth, maxBossHealth, onPause 
}) => {
  const [displayHealth, setDisplayHealth] = useState(health);
  const [displayBossHp, setDisplayBossHp] = useState(bossHealth);
  
  useEffect(() => {
      const timeout = setTimeout(() => setDisplayHealth(health), 100);
      return () => clearTimeout(timeout);
  }, [health]);

  useEffect(() => {
      const timeout = setTimeout(() => setDisplayBossHp(bossHealth), 100);
      return () => clearTimeout(timeout);
  }, [bossHealth]);

  const healthPercent = Math.max(0, Math.min(100, (health / maxHealth) * 100));
  const displayPercent = Math.max(0, Math.min(100, (displayHealth / maxHealth) * 100));

  const bossPercent = Math.max(0, Math.min(100, (bossHealth / maxBossHealth) * 100));
  const displayBossPercent = Math.max(0, Math.min(100, (displayBossHp / maxBossHealth) * 100));

  const chargePercent = cooldownRemaining * 100; 
  const isReady = chargePercent >= 100;

  const minutes = Math.floor(timeAlive / 60);
  const seconds = Math.floor(timeAlive % 60);
  const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  
  const handleAbilityClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isReady && !isActive) {
          audio.playSFX('ui');
          onActivateAutoBounce();
      }
  };

  const handleAbilityTouch = (e: React.TouchEvent) => {
      e.stopPropagation();
      if(isReady && !isActive) onActivateAutoBounce();
  };

  return (
    <div 
      className="absolute top-0 left-0 w-full pointer-events-none z-30 flex flex-col justify-between"
      style={{ padding: 'max(16px, env(safe-area-inset-top)) 16px 16px 16px', height: '100%' }}
    >
      
      {/* --- HEADER GRID --- */}
      <div className="w-full grid grid-cols-3 items-start">
           
           {/* LEFT: Pause Button */}
           <div className="flex justify-start">
               <button 
                  onClick={(e) => { e.stopPropagation(); onPause(); }}
                  className="pointer-events-auto w-10 h-10 rounded-full bg-black/40 border border-white/10 flex items-center justify-center backdrop-blur-md hover:bg-white/10 active:scale-95 transition-all"
               >
                  <Pause size={18} fill="white" className="text-white" />
               </button>
           </div>

           {/* CENTER: Score Cluster */}
           <div className="flex flex-col items-center">
                
                {/* 1. SCORE */}
                <div className="flex items-baseline gap-2 mb-1">
                    <h1 
                        className="text-5xl font-black text-white italic tracking-tighter font-sans leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                    >
                        {Math.floor(score).toLocaleString()}
                    </h1>
                    {multiplier > 1 && (
                        <div className="flex items-center gap-1 animate-bounce">
                            <span className="text-2xl font-black text-yellow-400 italic">x{multiplier}</span>
                        </div>
                    )}
                </div>

                {/* 2. BOSS BAR (Conditional) */}
                <div className={`transition-all duration-500 ease-out w-[280px] overflow-hidden ${bossHealth > 0 ? 'h-8 opacity-100 mb-1' : 'h-0 opacity-0'}`}>
                    <div className="flex justify-between items-end mb-0.5 px-1">
                        <span className="text-red-500 font-black tracking-widest uppercase text-[10px] drop-shadow-md">⚠️ BOSS</span>
                        <span className="text-white font-mono text-[10px]">{Math.floor(bossHealth)}</span>
                    </div>
                    <div className="h-4 w-full bg-black/80 border border-red-900/50 relative rounded-sm skew-x-[-10deg]">
                        <div 
                            className="h-full bg-red-600 transition-all duration-300 ease-out absolute top-0 left-0"
                            style={{ width: `${displayBossPercent}%` }}
                        />
                    </div>
                </div>

                {/* 3. HEALTH BAR */}
                <div className="w-[240px] relative group">
                    <div className="h-4 w-full bg-slate-900/90 rounded-full border border-white/20 backdrop-blur-sm relative overflow-hidden shadow-lg">
                        <div 
                            className="absolute top-0 left-0 h-full bg-red-500/50 transition-all duration-500 ease-out rounded-l-full"
                            style={{ width: `${displayPercent}%` }}
                        />
                        <div 
                            className="absolute top-0 left-0 h-full bg-gradient-to-r from-cyan-400 to-blue-600 transition-all duration-300 ease-out rounded-l-full"
                            style={{ width: `${healthPercent}%` }}
                        >
                            <div className="absolute top-0.5 left-0 right-0 h-[2px] bg-white/40 rounded-full"></div>
                        </div>
                    </div>
                    <div className="absolute -left-6 top-1/2 -translate-y-1/2 bg-black/60 px-1.5 py-0.5 rounded text-[8px] font-bold text-cyan-400 border border-cyan-900/50">
                        HP
                    </div>
                </div>

           </div>

           {/* RIGHT: Time */}
           <div className="flex justify-end">
               <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-md">
                   <Clock size={14} className="text-white/70"/>
                   <span className="font-mono text-lg font-bold text-white leading-none">{timeString}</span>
               </div>
           </div>
      </div>

      {/* --- ABILITY BUTTON (Bottom Right) --- */}
      {autoBounceUnlocked && (
          <div className="absolute bottom-8 right-8 pointer-events-auto z-50">
              <button
                  onMouseDown={handleAbilityClick}
                  onTouchStart={handleAbilityTouch}
                  disabled={!isReady && !isActive}
                  className={`
                      w-24 h-24 rounded-full border-4 flex flex-col items-center justify-center relative overflow-hidden
                      transition-all duration-100 shadow-xl select-none touch-manipulation
                      ${isActive 
                         ? 'border-white bg-green-500 shadow-[0_0_30px_#22c55e] scale-110' 
                         : (isReady ? 'border-green-400 bg-black/50 animate-pulse shadow-[0_0_20px_#4ade80] cursor-pointer hover:scale-105 active:scale-95' : 'border-slate-700 bg-black/80 grayscale opacity-70 cursor-not-allowed')
                      }
                  `}
              >
                  {!isActive && !isReady && (
                      <div className="absolute bottom-0 left-0 w-full bg-green-500/30 z-0 transition-all duration-300" style={{ height: `${chargePercent}%` }} />
                  )}

                  {!isActive && !isReady && (
                      <div className="absolute inset-0 z-20 flex items-center justify-center">
                          <span className="text-white font-mono font-bold text-xl">{Math.floor(chargePercent)}%</span>
                      </div>
                  )}

                  <Shield 
                      size={36} 
                      className={`z-10 transition-all duration-300 ${isActive ? 'text-white animate-spin' : (isReady ? 'text-green-400 drop-shadow-[0_0_5px_#22c55e]' : 'text-slate-500')}`} 
                  />
                  
                  <span className={`text-[10px] font-black z-10 mt-1 tracking-wider ${isActive ? 'text-white' : (isReady ? 'text-green-200' : 'text-slate-500')}`}>
                      {isActive ? 'ACTIVE' : (isReady ? 'READY' : 'CHARGING')}
                  </span>
              </button>
          </div>
      )}

    </div>
  );
};

export default HUD;
