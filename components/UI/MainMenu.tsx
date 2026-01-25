import React from 'react';
import { Play, ShoppingBag, Settings, BarChart2, Zap, Coins } from 'lucide-react';

interface MainMenuProps {
    onStart: () => void;
    onOpenShop: () => void;
    totalCoins: number;
    cameraZoom: number;
    setCameraZoom: (zoom: number) => void;
}

const MainMenu: React.FC<MainMenuProps> = ({ onStart, onOpenShop, totalCoins, cameraZoom, setCameraZoom }) => {
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
                <button className="flex flex-col items-center gap-1 hover:text-white transition-colors">
                    <Settings size={24} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Settings</span>
                </button>
                <button className="flex flex-col items-center gap-1 hover:text-white transition-colors">
                    <BarChart2 size={24} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Stats</span>
                </button>
            </div>

        </div>
    );
};

export default MainMenu;