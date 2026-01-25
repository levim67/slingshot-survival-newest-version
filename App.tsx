
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import GameCanvas from './components/GameCanvas';
import HUD from './components/UI/HUD';
import MainMenu from './components/UI/MainMenu';
import ResultsScreen from './components/UI/ResultsScreen';
import Shop from './components/UI/Shop';
import { GameStateStatus, Upgrades, UPGRADE_ITEMS } from './types';
import { initAudio } from './utils/audio';

const App: React.FC = () => {
  // Persistent State
  const [totalCoins, setTotalCoins] = useState<number>(() => {
      const saved = localStorage.getItem('slingshot_coins');
      return saved ? parseInt(saved) : 0;
  });
  
  const [upgradeLevels, setUpgradeLevels] = useState<Record<string, number>>(() => {
      const saved = localStorage.getItem('slingshot_upgrades_v5');
      if (saved) return JSON.parse(saved);
      
      // Default: All start at Level 0
      const defaults: Record<string, number> = {};
      UPGRADE_ITEMS.forEach(item => defaults[item.id] = 0);
      return defaults;
  });

  const [unlockedSkins, setUnlockedSkins] = useState<string[]>(() => {
      const saved = localStorage.getItem('slingshot_skins');
      return saved ? JSON.parse(saved) : ['default'];
  });

  const [currentSkin, setCurrentSkin] = useState<string>(() => {
      return localStorage.getItem('slingshot_current_skin') || 'default';
  });

  const [highScore, setHighScore] = useState<number>(() => {
      const saved = localStorage.getItem('slingshot_highscore');
      return saved ? parseInt(saved) : 0;
  });

  const [bestDistance, setBestDistance] = useState<number>(() => {
      const saved = localStorage.getItem('slingshot_best_distance');
      return saved ? parseInt(saved) : 0;
  });
  
  const [cameraZoom, setCameraZoom] = useState<number>(() => {
      const saved = localStorage.getItem('slingshot_zoom');
      return saved ? parseFloat(saved) : 0.6; 
  });

  // Calculate actual physics upgrades based on levels
  const currentUpgrades: Upgrades = useMemo(() => {
      // Default Stats Object
      const stats: any = {
        maxHealth: 100,
        slowMoTimeScale: 0.5,
        speedMultiplier: 1.0,
        maxComboCap: 10,
        missileChanceInterval: 0,
        missileCap: 0,
        splitChance: 0,
        splitCount: 0,
        bounceMissileChance: 0,
        bounceMissileCount: 0,
        autoBounceDuration: 0,
        autoBounceChargePerHit: 0,
        unlockGreenSpikeBreaker: false,
        unlockRedSpikeBreaker: false,
        unlockParagonSuperMissile: false,
        chainLightningChance: 0,
        chainLightningCount: 0
      };

      UPGRADE_ITEMS.forEach(item => {
          const level = upgradeLevels[item.id] || 0;
          
          if (item.category === 'PERMANENT' || item.category === 'PARAGON') {
              // Boolean flag based on ownership (level > 0)
              stats[item.stat] = level > 0;
          } else {
              // Standard linear scaling
              stats[item.stat] = item.baseValue + (item.increment * level);
          }

          if (item.secondaryStat && item.secondaryBase !== undefined && item.secondaryIncrement !== undefined) {
             stats[item.secondaryStat] = item.secondaryBase + (item.secondaryIncrement * level);
          }
      });
      return stats as Upgrades;
  }, [upgradeLevels]);

  // Session State
  const [status, setStatus] = useState<GameStateStatus>(GameStateStatus.MENU);
  const [sessionStats, setSessionStats] = useState({ health: 100, score: 0, distance: 0, multiplier: 1 });
  const [lastRunEarnings, setLastRunEarnings] = useState(0);
  const [gameId, setGameId] = useState(0); // Unique ID to force resets

  // Auto Bounce State for HUD
  const [hudState, setHudState] = useState({
     unlocked: false,
     cooldownRemaining: 0, 
     isActive: false,
     timeAlive: 0,
     bossHealth: 0,
     maxBossHealth: 1
  });

  const updateHUDState = useCallback((unlocked: boolean, cooldownRemaining: number, isActive: boolean, timeAlive: number, bossHealth: number, maxBossHealth: number) => {
      setHudState(prev => {
          // Micro-optimization to prevent react renders if nothing changed significantly
          if (prev.unlocked === unlocked && 
              prev.isActive === isActive && 
              Math.abs(prev.cooldownRemaining - cooldownRemaining) < 0.1 &&
              prev.timeAlive === timeAlive &&
              prev.bossHealth === bossHealth) {
              return prev;
          }
          return { unlocked, cooldownRemaining, isActive, timeAlive, bossHealth, maxBossHealth };
      });
  }, []);

  // Trigger from HUD to Game
  const [triggerAutoBounce, setTriggerAutoBounce] = useState(0);

  // Save loop
  useEffect(() => {
    localStorage.setItem('slingshot_coins', totalCoins.toString());
    localStorage.setItem('slingshot_upgrades_v5', JSON.stringify(upgradeLevels));
    localStorage.setItem('slingshot_skins', JSON.stringify(unlockedSkins));
    localStorage.setItem('slingshot_current_skin', currentSkin);
    localStorage.setItem('slingshot_highscore', highScore.toString());
    localStorage.setItem('slingshot_best_distance', bestDistance.toString());
    localStorage.setItem('slingshot_zoom', cameraZoom.toString());
  }, [totalCoins, upgradeLevels, unlockedSkins, currentSkin, highScore, bestDistance, cameraZoom]);

  const startGame = () => {
    initAudio().catch(err => console.error("Audio Init Failed:", err));
    setStatus(GameStateStatus.PLAYING);
    setSessionStats({ health: currentUpgrades.maxHealth, score: 0, distance: 0, multiplier: 1 });
    // Force GameCanvas to reset
    setGameId(prev => prev + 1);
    setTriggerAutoBounce(0);
  };

  const togglePause = () => {
    if (status === GameStateStatus.PLAYING) setStatus(GameStateStatus.PAUSED);
    else if (status === GameStateStatus.PAUSED) setStatus(GameStateStatus.PLAYING);
  };

  const handleGameOver = (finalScore: number) => {
    const earnedCoins = Math.floor(finalScore / 10); 
    setLastRunEarnings(earnedCoins);
    setTotalCoins(prev => prev + earnedCoins);
    
    if (finalScore > highScore) setHighScore(finalScore);
    if (sessionStats.distance > bestDistance) setBestDistance(sessionStats.distance);

    setStatus(GameStateStatus.GAME_OVER);
  };

  const handleUpgradePurchase = (itemId: string, cost: number) => {
    if (totalCoins >= cost) {
        setTotalCoins(prev => prev - cost);
        setUpgradeLevels(prev => {
            const nextLevel = (prev[itemId] || 0) + 1;
            return { ...prev, [itemId]: nextLevel };
        });
    }
  };

  const handleSkinPurchase = (skinId: string, cost: number) => {
      if (totalCoins >= cost) {
          setTotalCoins(prev => prev - cost);
          setUnlockedSkins(prev => [...prev, skinId]);
      }
  };

  return (
    <div className="relative w-full h-screen bg-slate-900 overflow-hidden select-none">
      {/* Game Canvas is always mounted but logic pauses when not playing */}
      <GameCanvas 
        status={status} 
        gameId={gameId}
        upgrades={currentUpgrades}
        autoBounceLevel={upgradeLevels['auto_bounce'] || 0}
        onGameOver={handleGameOver}
        onUpdateStats={(health, score, distance, multiplier) => setSessionStats({ health, score, distance, multiplier })}
        onUpdateHUD={updateHUDState}
        triggerAutoBounce={triggerAutoBounce}
        skin={currentSkin}
        baseZoom={cameraZoom}
      />

      {status === GameStateStatus.MENU && (
        <MainMenu 
          onStart={startGame} 
          onOpenShop={() => setStatus(GameStateStatus.SHOP)}
          totalCoins={totalCoins}
          cameraZoom={cameraZoom}
          setCameraZoom={setCameraZoom}
        />
      )}

      {status === GameStateStatus.SHOP && (
        <Shop 
          onClose={() => setStatus(GameStateStatus.MENU)}
          coins={totalCoins}
          upgradeLevels={upgradeLevels}
          onPurchaseUpgrade={handleUpgradePurchase}
          onPurchaseSkin={handleSkinPurchase}
          unlockedSkins={unlockedSkins}
          currentSkin={currentSkin}
          onEquipSkin={setCurrentSkin}
        />
      )}

      {/* PAUSE OVERLAY */}
      {status === GameStateStatus.PAUSED && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
           <div className="flex flex-col items-center gap-6">
              <h2 className="text-4xl font-black text-white italic">PAUSED</h2>
              <button onClick={togglePause} className="bg-white text-black px-8 py-3 rounded-full font-bold text-xl hover:scale-105 transition-transform">RESUME</button>
              <button onClick={() => setStatus(GameStateStatus.MENU)} className="text-white/70 hover:text-white font-bold">EXIT TO MENU</button>
           </div>
        </div>
      )}

      {(status === GameStateStatus.PLAYING || status === GameStateStatus.PAUSED) && (
        <HUD 
          health={sessionStats.health} 
          maxHealth={currentUpgrades.maxHealth}
          score={sessionStats.score}
          distance={sessionStats.distance}
          multiplier={sessionStats.multiplier}
          autoBounceUnlocked={(upgradeLevels['auto_bounce'] || 0) > 0}
          cooldownRemaining={hudState.cooldownRemaining}
          isActive={hudState.isActive}
          onActivateAutoBounce={() => setTriggerAutoBounce(Date.now())}
          timeAlive={hudState.timeAlive}
          bossHealth={hudState.bossHealth}
          maxBossHealth={hudState.maxBossHealth}
          onPause={togglePause}
        />
      )}

      {status === GameStateStatus.GAME_OVER && (
        <ResultsScreen
            score={sessionStats.score}
            earnedCoins={lastRunEarnings}
            totalCoins={totalCoins}
            onInstantReplay={startGame}
            onMenu={() => setStatus(GameStateStatus.MENU)}
        />
      )}
    </div>
  );
};

export default App;
