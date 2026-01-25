
import React, { useState } from 'react';
import { ArrowLeft, Coins, Zap, Heart, Clock, ChevronsUp, Palette, Rocket, GitFork, Target, Shield, Hammer, Lock, Check, Sparkles } from 'lucide-react';
import { UPGRADE_ITEMS, SKIN_ITEMS } from '../../types';

interface ShopProps {
  onClose: () => void;
  coins: number;
  upgradeLevels: Record<string, number>;
  onPurchaseUpgrade: (id: string, cost: number) => void;
  onPurchaseSkin: (skinId: string, cost: number) => void;
  unlockedSkins: string[];
  currentSkin: string;
  onEquipSkin: (skinId: string) => void;
}

const Shop: React.FC<ShopProps> = ({ 
    onClose, coins, upgradeLevels, onPurchaseUpgrade, onPurchaseSkin, unlockedSkins, currentSkin, onEquipSkin
}) => {
  
  const [activeTab, setActiveTab] = useState<'ESSENTIALS' | 'UTILITY' | 'PERMANENT' | 'PARAGON' | 'COSMETICS'>('ESSENTIALS');

  const getIcon = (type: string) => {
    switch(type) {
        case 'health': return <Heart size={20} className="text-red-400" />;
        case 'time': return <Clock size={20} className="text-blue-400" />;
        case 'speed': return <ChevronsUp size={20} className="text-yellow-400" />;
        case 'combo': return <Zap size={20} className="text-purple-400" />;
        case 'missile': return <Rocket size={20} className="text-orange-400" />;
        case 'split': return <GitFork size={20} className="text-pink-400" />;
        case 'bounce_missile': return <Target size={20} className="text-cyan-400" />;
        case 'auto_bounce': return <Shield size={20} className="text-green-400" />;
        case 'spike': return <Hammer size={20} className="text-red-400" />;
        case 'lightning': return <Zap size={20} className="text-yellow-300" />;
        case 'paragon': return <Sparkles size={20} className="text-cyan-200" />;
        default: return <Coins size={20} />;
    }
  };

  const isParagonUnlocked = (upgradeLevels['missiles'] || 0) >= 9 && (upgradeLevels['bounce_missile'] || 0) >= 9;

  return (
    <div className="absolute inset-0 flex flex-col items-center bg-black/95 z-20 backdrop-blur-md font-sans text-white pt-8 pb-4">
      
      {/* Header */}
      <div className="w-full max-w-lg px-6 flex items-center justify-between mb-4 border-b border-white/10 pb-4">
        <button 
            onClick={onClose} 
            className="p-2 -ml-2 hover:bg-white/10 rounded-full transition-colors"
        >
          <ArrowLeft size={28} />
        </button>
        <div className="flex flex-col items-center">
            <h2 className="text-2xl font-black tracking-[0.2em] italic">ARMORY</h2>
        </div>
        <div className="flex items-center gap-2 bg-yellow-500/10 px-3 py-1 rounded-lg border border-yellow-500/30">
          <span className="font-mono font-bold text-yellow-400 text-lg">{coins.toLocaleString()}</span>
          <Coins size={18} className="text-yellow-400" />
        </div>
      </div>

      {/* TABS */}
      <div className="w-full max-w-lg px-6 flex gap-2 mb-6 overflow-x-auto no-scrollbar">
          {['ESSENTIALS', 'UTILITY', 'PERMANENT', 'PARAGON', 'COSMETICS'].map((tab) => (
             <button 
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`flex-1 py-3 px-2 font-bold uppercase tracking-wider text-[10px] sm:text-xs border-b-2 transition-all whitespace-nowrap
                    ${activeTab === tab 
                        ? (tab === 'PARAGON' ? 'border-cyan-300 text-cyan-200 bg-cyan-900/20' : 'border-cyan-400 text-cyan-400 bg-cyan-400/10') 
                        : 'border-transparent text-white/50 hover:bg-white/5'
                    }
                    ${tab === 'PARAGON' && !isParagonUnlocked ? 'opacity-50 grayscale' : ''}
                `}
            >
                {tab.replace('_', ' ')} {tab === 'PARAGON' && !isParagonUnlocked && <Lock size={10} className="inline ml-1"/>}
            </button>
          ))}
      </div>

      {/* Content Scroll */}
      <div className="flex-1 w-full max-w-lg overflow-y-auto px-6 space-y-4 pb-20 mask-gradient-bottom">
        
        {/* PARAGON LOCK SCREEN */}
        {activeTab === 'PARAGON' && !isParagonUnlocked ? (
            <div className="flex flex-col items-center justify-center h-64 text-center p-6 border border-white/10 rounded-xl bg-slate-900/50">
                <Lock size={48} className="text-white/20 mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">ACCESS DENIED</h3>
                <p className="text-sm text-white/50 mb-4">You must master standard weaponry before accessing Paragon technology.</p>
                <div className="flex flex-col gap-2 w-full text-xs font-mono">
                    <div className={`flex justify-between p-2 rounded ${upgradeLevels['missiles'] >= 9 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                        <span>Auto Missiles Lv 9</span>
                        <span>{upgradeLevels['missiles'] || 0}/9</span>
                    </div>
                    <div className={`flex justify-between p-2 rounded ${upgradeLevels['bounce_missile'] >= 9 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                        <span>Bounce Missile Lv 9</span>
                        <span>{upgradeLevels['bounce_missile'] || 0}/9</span>
                    </div>
                </div>
            </div>
        ) : (
            // STANDARD UPGRADES VIEW (Includes Paragon if Unlocked)
            (activeTab === 'ESSENTIALS' || activeTab === 'UTILITY' || activeTab === 'PERMANENT' || activeTab === 'PARAGON') && (
                <div className="space-y-4">
                    {UPGRADE_ITEMS.filter(i => i.category === activeTab).map((item) => {
                        const currentLevel = upgradeLevels[item.id] || 0;
                        const isMaxed = currentLevel >= item.maxLevel;
                        const costIndex = currentLevel; 
                        const nextCost = !isMaxed ? item.costs[costIndex] : 0;
                        const canAfford = coins >= nextCost;
                        const isPermanent = item.category === 'PERMANENT' || item.category === 'PARAGON';
                        const isParagon = item.category === 'PARAGON';

                        return (
                            <div 
                                key={item.id} 
                                className={`
                                    border p-4 rounded-xl relative overflow-hidden group transition-colors
                                    ${isParagon ? 'bg-cyan-950/40 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.1)]' : ''}
                                    ${isPermanent && !isParagon && isMaxed ? 'bg-yellow-900/20 border-yellow-500/50' : ''}
                                    ${isMaxed && !isPermanent ? 'bg-slate-900/40 border-green-500/30' : ''}
                                    ${!isMaxed && !isParagon ? 'bg-slate-900/80 border-white/10 hover:border-white/20' : ''}
                                `}
                            >
                                <div className="flex justify-between items-start mb-3 relative z-10">
                                    <div className="flex gap-4">
                                        <div className={`p-3 rounded-lg border shadow-inner h-fit 
                                            ${isParagon ? 'bg-cyan-900/20 border-cyan-400/30' : (isPermanent ? 'bg-yellow-900/20 border-yellow-500/20' : 'bg-slate-800 border-white/5')}
                                        `}>
                                            {getIcon(item.iconType)}
                                        </div>
                                        <div>
                                            <div className="flex items-baseline gap-2">
                                                <h4 className={`font-bold text-lg leading-none ${isParagon ? 'text-cyan-200' : (isPermanent ? 'text-yellow-100' : 'text-white')}`}>
                                                    {item.name}
                                                </h4>
                                                {item.maxLevel > 1 && <span className="text-xs font-mono text-cyan-400">Lv {currentLevel}/{item.maxLevel}</span>}
                                            </div>
                                            <p className={`text-xs font-medium mt-1 max-w-[200px] ${isParagon ? 'text-cyan-100/70' : 'text-white/50'}`}>{item.description}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Controls */}
                                <div className="flex justify-between items-end relative z-10 mt-4">
                                    {/* Progress Bar (Only for multi-level) */}
                                    {item.maxLevel > 1 ? (
                                        <div className="flex gap-1 mb-1.5">
                                            {Array.from({ length: item.maxLevel }).map((_, idx) => {
                                                const filled = (idx + 1) <= currentLevel;
                                                return (
                                                    <div 
                                                        key={idx}
                                                        className={`
                                                            w-3 h-3 rounded-[1px]
                                                            ${filled 
                                                                ? 'bg-cyan-400 shadow-[0_0_5px_rgba(34,211,238,0.5)]' 
                                                                : 'bg-white/10'}
                                                            transition-all duration-300
                                                        `}
                                                    />
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        // Single Level Status
                                        <div className="flex items-center gap-2 mb-1">
                                            {isMaxed ? 
                                                <span className="text-green-400 text-xs font-black uppercase tracking-widest flex items-center gap-1"><Check size={12}/> {isParagon ? 'ACQUIRED' : 'ACTIVE'}</span> 
                                                : 
                                                <span className="text-white/30 text-xs font-bold uppercase tracking-widest flex items-center gap-1"><Lock size={12}/> Locked</span>
                                            }
                                        </div>
                                    )}
                                    
                                    {/* Buy Button */}
                                    {isMaxed ? (
                                        <button disabled className={`
                                            font-bold px-6 py-2 rounded-lg text-sm border cursor-default
                                            ${isParagon 
                                                ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40' 
                                                : (isPermanent 
                                                    ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40' 
                                                    : 'bg-green-500/10 text-green-400 border-green-500/20')}
                                        `}>
                                            {item.maxLevel === 1 ? "OWNED" : "MAXED"}
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={() => onPurchaseUpgrade(item.id, nextCost)}
                                            disabled={!canAfford}
                                            className={`
                                                flex items-center gap-2 px-5 py-2 rounded-lg font-bold text-sm transition-all
                                                ${canAfford 
                                                    ? 'bg-yellow-400 text-black hover:bg-yellow-300 hover:scale-105 shadow-lg shadow-yellow-400/20' 
                                                    : 'bg-slate-800 text-white/30 cursor-not-allowed border border-white/5'}
                                            `}
                                        >
                                            <span>{isPermanent ? 'UNLOCK' : 'UPGRADE'}</span>
                                            <div className="w-[1px] h-3 bg-current opacity-20 mx-1"></div>
                                            <span className="flex items-center gap-1">
                                                {nextCost.toLocaleString()} <Coins size={12} strokeWidth={3} />
                                            </span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )
        )}

        {activeTab === 'COSMETICS' && (
            <div className="grid grid-cols-1 gap-3">
                <div className="text-xs text-white/40 uppercase tracking-widest font-bold mb-2">Skins</div>
                {SKIN_ITEMS.map((skin) => {
                    const isUnlocked = unlockedSkins.includes(skin.skinId);
                    const isEquipped = currentSkin === skin.skinId;
                    const canAfford = coins >= skin.cost;

                    return (
                        <div key={skin.id} className={`p-4 border rounded-xl flex items-center justify-between ${isEquipped ? 'bg-purple-900/20 border-purple-500/50' : 'bg-slate-900/50 border-white/10'}`}>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-800 rounded-md">
                                    <Palette size={16} className={isEquipped ? 'text-purple-400' : 'text-white/50'} />
                                </div>
                                <div>
                                    <h4 className={`font-bold ${isEquipped ? 'text-purple-300' : 'text-white'}`}>{skin.name}</h4>
                                    <p className="text-xs text-white/40">{skin.description}</p>
                                </div>
                            </div>

                            {isUnlocked ? (
                                <button 
                                    onClick={() => onEquipSkin(skin.skinId)}
                                    disabled={isEquipped}
                                    className={`
                                        px-4 py-1.5 rounded-md text-xs font-black tracking-wider uppercase transition-all
                                        ${isEquipped 
                                            ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30' 
                                            : 'bg-white/10 text-white hover:bg-white/20'}
                                    `}
                                >
                                    {isEquipped ? 'Equipped' : 'Equip'}
                                </button>
                            ) : (
                                <button 
                                    onClick={() => onPurchaseSkin(skin.skinId, skin.cost)}
                                    disabled={!canAfford}
                                    className={`
                                        px-4 py-1.5 rounded-md text-xs font-black tracking-wider uppercase flex items-center gap-1 transition-all
                                        ${canAfford 
                                            ? 'bg-white text-black hover:bg-gray-200' 
                                            : 'bg-white/5 text-white/20'}
                                    `}
                                >
                                    {skin.cost} <Coins size={10} strokeWidth={3} />
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        )}

      </div>
    </div>
  );
};

export default Shop;
