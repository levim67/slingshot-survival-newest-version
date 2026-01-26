import React, { useState } from 'react';
import { Play, ShoppingBag, Settings, BarChart2, Zap, Coins, X, Music, Volume2 } from 'lucide-react';
import * as audio from '../../utils/audio';

interface MainMenuProps {
    onStart: () => void;
    onOpenShop: () => void;
    totalCoins: number;
    cameraZoom: number;
    setCameraZoom: (zoom: number) => void;
}

const MainMenu: React.FC<MainMenuProps> = ({ onStart, onOpenShop, totalCoins, cameraZoom, setCameraZoom }) => {
    const [showSettings, setShowSettings] = useState(false);
    const [musicVol, setMusicVol] = useState(0.5);
    const [sfxVol, setSFXVol] = useState(0.8);

    return (
        <div className="absolute inset-0 flex flex-col bg-slate-900/95 z-30 backdrop-blur-sm font-sans text-white">

            {/* HEADER / COINS */}
            <div className="w-full p-6 flex justify-between items-center border-b border-white/5 bg-black/20">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_10px_lime]"></div>
                    <span className="text-xs font-bold tracking-widest text-white/50 uppercase">Online</span>
                </div>

                <div className="flex items-center gap-2 bg-yellow-500/10 px-4 py-2 rounded-full border border-yellow-500/20 shadow-lg">
                    <Coins className="text-yellow-400" size={20} />
                    <span className="font-mono font-bold text-xl text-yellow-400">{totalCoins.toLocaleString()}</span>
                </div>
            </div>

            {/* CENTER CONTENT */}
            <div className="flex-1 flex flex-col items-center justify-center gap-10">

                {/* LOGO */}
                <div className="text-center transform -translate-y-4">
                    <h1 className="text-6xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-cyan-400 to-blue-600 drop-shadow-[0_0_15px_rgba(6,182,212,0.5)]">
                        SLINGSHOT
                    </h1>
                    <h2 className="text-4xl font-black text-white tracking-widest -mt-2">
                        SURVIVAL
                    </h2>
                </div>

                {/* MAIN ACTIONS */}
                <div className="flex flex-col gap-4 w-full max-w-xs">
                    <button
                        onClick={onStart}
                        className="group relative bg-white text-black h-16 rounded-xl font-black text-2xl uppercase tracking-wider overflow-hidden hover:scale-105 transition-transform shadow-[0_0_30px_rgba(255,255,255,0.3)]"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-white to-cyan-400 opacity-0 group-hover:opacity-20 transition-opacity"></div>
                        <span className="relative z-10 flex items-center justify-center gap-2">
                            <Play fill="black" size={28} /> Play Now
                        </span>
                    </button>

                    <button
                        onClick={onOpenShop}
                        className="bg-purple-600/20 border border-purple-500/50 h-16 rounded-xl flex items-center justify-center gap-3 hover:bg-purple-600/40 transition-colors group"
                    >
                        <div className="p-2 bg-purple-500 rounded-full group-hover:scale-110 transition-transform shadow-lg shadow-purple-500/40">
                            <ShoppingBag className="text-white" size={20} />
                        </div>
                        <span className="font-bold text-purple-200 uppercase text-lg tracking-wider">Shop</span>
                    </button>
                </div>
            </div>

            {/* FOOTER / SETTINGS */}
            <div className="w-full p-8 flex justify-center gap-8 text-white/40">
                <button
                    onClick={() => setShowSettings(true)}
                    className="flex flex-col items-center gap-1 hover:text-white transition-colors"
                >
                    <Settings size={24} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Settings</span>
                </button>
                <button className="flex flex-col items-center gap-1 hover:text-white transition-colors">
                    <BarChart2 size={24} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Stats</span>
                </button>
            </div>

            {/* SETTINGS MODAL */}
            {showSettings && (
                <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-6">
                    <div className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in duration-300">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-xl font-black italic uppercase tracking-wider text-white">Settings</h3>
                            <button onClick={() => setShowSettings(false)} className="bg-white/10 p-2 rounded-full hover:bg-white/20">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex flex-col gap-8">
                            {/* MUSIC VOLUME */}
                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between text-sm font-bold text-cyan-400 uppercase tracking-widest">
                                    <span className="flex items-center gap-2"><Music size={16} /> Music</span>
                                    <span>{Math.round(musicVol * 100)}%</span>
                                </div>
                                <input
                                    type="range" min="0" max="1" step="0.05"
                                    value={musicVol}
                                    onChange={(e) => {
                                        const v = parseFloat(e.target.value);
                                        setMusicVol(v);
                                        audio.setMusicVolume(v);
                                    }}
                                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                                />
                            </div>

                            {/* SFX VOLUME */}
                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between text-sm font-bold text-yellow-500 uppercase tracking-widest">
                                    <span className="flex items-center gap-2"><Volume2 size={16} /> SFX</span>
                                    <span>{Math.round(sfxVol * 100)}%</span>
                                </div>
                                <input
                                    type="range" min="0" max="1" step="0.05"
                                    value={sfxVol}
                                    onChange={(e) => {
                                        const v = parseFloat(e.target.value);
                                        setSFXVol(v);
                                        audio.setSFXVolume(v);
                                    }}
                                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-yellow-400"
                                />
                            </div>
                        </div>

                        <div className="mt-8 pt-8 border-t border-white/10 text-center">
                            <p className="text-xs text-white/30 uppercase tracking-widest">Build v0.4.3 (Camera Fix)</p>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default MainMenu;