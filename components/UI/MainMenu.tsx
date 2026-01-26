import React, { useState } from 'react';
import { Play, ShoppingBag, Settings, BarChart2, Coins, X, Music, Volume2, RotateCcw, ChevronRight } from 'lucide-react';
import * as audio from '../../utils/audio';

interface MainMenuProps {
    onStart: () => void;
    onOpenShop: () => void;
    totalCoins: number;
    cameraZoom: number;
    setCameraZoom: (zoom: number) => void;
    onResetProgress?: () => void;
}

const MainMenu: React.FC<MainMenuProps> = ({ onStart, onOpenShop, totalCoins, onResetProgress }) => {
    const [showSettings, setShowSettings] = useState(false);
    const [musicVol, setMusicVol] = useState(0.5);
    const [sfxVol, setSFXVol] = useState(0.8);

    return (
        <div
            className="fixed inset-0 z-30 overflow-hidden touch-none select-none"
            style={{
                background: 'linear-gradient(135deg, #0a0a1a 0%, #1a0a2e 50%, #0f0f2a 100%)',
                fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
            }}
        >
            {/* Animated Background Effects */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {/* Floating orbs */}
                <div
                    className="absolute w-96 h-96 rounded-full opacity-20 blur-3xl"
                    style={{
                        background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)',
                        top: '-10%',
                        right: '-10%',
                        animation: 'float 8s ease-in-out infinite',
                    }}
                />
                <div
                    className="absolute w-80 h-80 rounded-full opacity-15 blur-3xl"
                    style={{
                        background: 'radial-gradient(circle, #8b5cf6 0%, transparent 70%)',
                        bottom: '10%',
                        left: '-15%',
                        animation: 'float 10s ease-in-out infinite reverse',
                    }}
                />
                <div
                    className="absolute w-64 h-64 rounded-full opacity-10 blur-2xl"
                    style={{
                        background: 'radial-gradient(circle, #06b6d4 0%, transparent 70%)',
                        top: '40%',
                        right: '20%',
                        animation: 'float 6s ease-in-out infinite',
                    }}
                />
                {/* Grid pattern overlay */}
                <div
                    className="absolute inset-0 opacity-5"
                    style={{
                        backgroundImage: `
                            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
                        `,
                        backgroundSize: '40px 40px',
                    }}
                />
            </div>

            {/* CSS Keyframes */}
            <style>{`
                @keyframes float {
                    0%, 100% { transform: translateY(0) scale(1); }
                    50% { transform: translateY(-20px) scale(1.05); }
                }
                @keyframes pulse-glow {
                    0%, 100% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.4), 0 0 60px rgba(59, 130, 246, 0.2); }
                    50% { box-shadow: 0 0 30px rgba(59, 130, 246, 0.6), 0 0 80px rgba(59, 130, 246, 0.3); }
                }
                @keyframes shimmer {
                    0% { background-position: -200% center; }
                    100% { background-position: 200% center; }
                }
            `}</style>

            {/* MAIN LAYOUT - Mobile-First */}
            <div className="relative w-full h-full flex flex-col" style={{ padding: 'env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)' }}>

                {/* TOP BAR */}
                <div className="flex justify-between items-center px-4 py-3 sm:px-6 sm:py-4">
                    {/* Settings Button - TOP LEFT for easy mobile access */}
                    <button
                        onClick={() => setShowSettings(true)}
                        className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl transition-all active:scale-95"
                        style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            backdropFilter: 'blur(10px)',
                        }}
                    >
                        <Settings size={18} className="text-white/70" />
                        <span className="text-xs sm:text-sm font-semibold text-white/70 uppercase tracking-wide hidden sm:inline">Settings</span>
                    </button>

                    {/* Coin Display */}
                    <div
                        className="flex items-center gap-2 px-4 py-2 rounded-full"
                        style={{
                            background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(245, 158, 11, 0.1) 100%)',
                            border: '1px solid rgba(251, 191, 36, 0.3)',
                            boxShadow: '0 0 20px rgba(251, 191, 36, 0.15)',
                        }}
                    >
                        <Coins className="text-yellow-400" size={20} />
                        <span className="font-bold text-lg sm:text-xl text-yellow-400" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                            {totalCoins.toLocaleString()}
                        </span>
                    </div>
                </div>

                {/* CENTER CONTENT */}
                <div className="flex-1 flex flex-col items-center justify-center px-6 py-4">

                    {/* LOGO */}
                    <div className="text-center mb-8 sm:mb-12">
                        <h1
                            className="text-5xl sm:text-7xl lg:text-8xl font-black tracking-tighter"
                            style={{
                                background: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 25%, #8b5cf6 50%, #a855f7 75%, #3b82f6 100%)',
                                backgroundSize: '200% auto',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                filter: 'drop-shadow(0 0 30px rgba(59, 130, 246, 0.5))',
                                animation: 'shimmer 3s linear infinite',
                            }}
                        >
                            SLINGSHOT
                        </h1>
                        <div className="flex items-center justify-center gap-3 mt-1 sm:mt-2">
                            <div className="h-px flex-1 max-w-16 sm:max-w-24 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                            <h2
                                className="text-2xl sm:text-3xl lg:text-4xl font-bold uppercase tracking-[0.3em] text-white/90"
                                style={{ textShadow: '0 0 20px rgba(255,255,255,0.3)' }}
                            >
                                SURVIVAL
                            </h2>
                            <div className="h-px flex-1 max-w-16 sm:max-w-24 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                        </div>
                    </div>

                    {/* ACTION BUTTONS */}
                    <div className="flex flex-col gap-4 w-full max-w-xs sm:max-w-sm">

                        {/* PLAY BUTTON - Primary CTA */}
                        <button
                            onClick={onStart}
                            className="relative group w-full h-16 sm:h-18 rounded-2xl font-bold text-xl sm:text-2xl uppercase tracking-wider overflow-hidden transition-all active:scale-[0.98]"
                            style={{
                                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)',
                                boxShadow: '0 4px 20px rgba(59, 130, 246, 0.4), 0 0 40px rgba(59, 130, 246, 0.2), inset 0 1px 0 rgba(255,255,255,0.2)',
                                animation: 'pulse-glow 2s ease-in-out infinite',
                            }}
                        >
                            {/* Shine effect */}
                            <div
                                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                                style={{
                                    background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)',
                                    transform: 'skewX(-20deg) translateX(-100%)',
                                    animation: 'none',
                                }}
                            />
                            <span className="relative z-10 flex items-center justify-center gap-3 text-white">
                                <Play fill="currentColor" size={26} />
                                Play Now
                            </span>
                        </button>

                        {/* SHOP BUTTON */}
                        <button
                            onClick={onOpenShop}
                            className="relative group w-full h-14 sm:h-16 rounded-xl font-semibold text-lg uppercase tracking-wider overflow-hidden transition-all active:scale-[0.98]"
                            style={{
                                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(139, 92, 246, 0.15) 100%)',
                                border: '1px solid rgba(168, 85, 247, 0.4)',
                                boxShadow: '0 4px 15px rgba(168, 85, 247, 0.15)',
                            }}
                        >
                            <span className="relative z-10 flex items-center justify-center gap-3 text-purple-300">
                                <div
                                    className="p-1.5 rounded-lg"
                                    style={{
                                        background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
                                        boxShadow: '0 0 15px rgba(168, 85, 247, 0.5)',
                                    }}
                                >
                                    <ShoppingBag size={18} className="text-white" />
                                </div>
                                Upgrades Shop
                                <ChevronRight size={18} className="text-purple-400/60" />
                            </span>
                        </button>

                        {/* STATS BUTTON */}
                        <button
                            className="w-full h-12 sm:h-14 rounded-xl font-medium text-base uppercase tracking-wider transition-all active:scale-[0.98]"
                            style={{
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.08)',
                            }}
                        >
                            <span className="flex items-center justify-center gap-2 text-white/50">
                                <BarChart2 size={18} />
                                View Stats
                            </span>
                        </button>
                    </div>
                </div>

                {/* BOTTOM INFO */}
                <div className="px-6 py-4 text-center">
                    <p className="text-[10px] sm:text-xs text-white/20 uppercase tracking-widest">
                        v0.5.0 • Mobile Optimized
                    </p>
                </div>
            </div>

            {/* SETTINGS MODAL */}
            {showSettings && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
                    style={{
                        background: 'rgba(0,0,0,0.85)',
                        backdropFilter: 'blur(20px)',
                    }}
                >
                    <div
                        className="w-full max-w-sm rounded-3xl p-6 sm:p-8 overflow-hidden"
                        style={{
                            background: 'linear-gradient(145deg, rgba(30,30,50,0.95) 0%, rgba(20,20,35,0.98) 100%)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            boxShadow: '0 25px 80px rgba(0,0,0,0.8), 0 0 1px rgba(255,255,255,0.1) inset',
                        }}
                    >
                        {/* Modal Header */}
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-wider text-white">
                                Settings
                            </h3>
                            <button
                                onClick={() => setShowSettings(false)}
                                className="p-2.5 rounded-xl transition-all active:scale-90"
                                style={{
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                }}
                            >
                                <X size={22} className="text-white/70" />
                            </button>
                        </div>

                        {/* Volume Controls */}
                        <div className="flex flex-col gap-6">

                            {/* MUSIC VOLUME */}
                            <div className="flex flex-col gap-3">
                                <div className="flex justify-between items-center">
                                    <span className="flex items-center gap-2 text-sm font-bold text-cyan-400 uppercase tracking-widest">
                                        <Music size={16} /> Music
                                    </span>
                                    <span
                                        className="text-sm font-bold text-cyan-400 px-2 py-0.5 rounded"
                                        style={{ background: 'rgba(6,182,212,0.15)' }}
                                    >
                                        {Math.round(musicVol * 100)}%
                                    </span>
                                </div>
                                <input
                                    type="range" min="0" max="1" step="0.05"
                                    value={musicVol}
                                    onChange={(e) => {
                                        const v = parseFloat(e.target.value);
                                        setMusicVol(v);
                                        audio.setMusicVolume(v);
                                    }}
                                    className="w-full h-3 rounded-full appearance-none cursor-pointer"
                                    style={{
                                        background: `linear-gradient(to right, #06b6d4 0%, #06b6d4 ${musicVol * 100}%, rgba(255,255,255,0.1) ${musicVol * 100}%, rgba(255,255,255,0.1) 100%)`,
                                    }}
                                />
                            </div>

                            {/* SFX VOLUME */}
                            <div className="flex flex-col gap-3">
                                <div className="flex justify-between items-center">
                                    <span className="flex items-center gap-2 text-sm font-bold text-amber-400 uppercase tracking-widest">
                                        <Volume2 size={16} /> Sound FX
                                    </span>
                                    <span
                                        className="text-sm font-bold text-amber-400 px-2 py-0.5 rounded"
                                        style={{ background: 'rgba(245,158,11,0.15)' }}
                                    >
                                        {Math.round(sfxVol * 100)}%
                                    </span>
                                </div>
                                <input
                                    type="range" min="0" max="1" step="0.05"
                                    value={sfxVol}
                                    onChange={(e) => {
                                        const v = parseFloat(e.target.value);
                                        setSFXVol(v);
                                        audio.setSFXVolume(v);
                                    }}
                                    className="w-full h-3 rounded-full appearance-none cursor-pointer"
                                    style={{
                                        background: `linear-gradient(to right, #f59e0b 0%, #f59e0b ${sfxVol * 100}%, rgba(255,255,255,0.1) ${sfxVol * 100}%, rgba(255,255,255,0.1) 100%)`,
                                    }}
                                />
                            </div>
                        </div>

                        {/* Danger Zone */}
                        <div className="mt-8 pt-6 border-t border-white/10">
                            <button
                                onClick={() => {
                                    if (confirm('Reset all progress? This cannot be undone!')) {
                                        onResetProgress?.();
                                    }
                                }}
                                className="w-full py-3 rounded-xl font-semibold text-sm uppercase tracking-wider transition-all active:scale-[0.98]"
                                style={{
                                    background: 'rgba(239, 68, 68, 0.1)',
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                    color: 'rgba(248, 113, 113, 0.9)',
                                }}
                            >
                                <span className="flex items-center justify-center gap-2">
                                    <RotateCcw size={16} />
                                    Reset Progress
                                </span>
                            </button>
                        </div>

                        {/* Version */}
                        <div className="mt-6 text-center">
                            <p className="text-[10px] text-white/20 uppercase tracking-widest">
                                Slingshot Survival v0.5.0
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MainMenu;