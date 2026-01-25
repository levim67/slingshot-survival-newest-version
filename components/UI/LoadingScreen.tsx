
import React, { useEffect, useState } from 'react';

interface LoadingScreenProps {
    onComplete: () => void;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ onComplete }) => {
    const [progress, setProgress] = useState(0);
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        const duration = 5000; // 5 seconds
        const interval = 50; // Update every 50ms
        const steps = duration / interval;
        const increment = 100 / steps;

        const timer = setInterval(() => {
            setProgress(prev => {
                const next = prev + increment;
                if (next >= 100) {
                    clearInterval(timer);
                    setIsReady(true);
                    return 100;
                }
                return next;
            });
        }, interval);

        return () => clearInterval(timer);
    }, []);

    return (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black">
            {/* Background */}
            <div
                className="absolute inset-0 z-0 bg-cover bg-center"
                style={{ backgroundImage: `url('https://raw.githubusercontent.com/levim67/slingshot-survival-assets/main/background.png')` }}
            />

            {/* Overlay to ensure text/ui readability if needed */}
            <div className="absolute inset-0 bg-black/30 z-0" />

            {/* Loading Container - Lowered to not cover logo */}
            <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-2xl px-4 mt-32">

                {/* Loading UI / Bar Area */}
                <div className="relative w-[300px] h-[60px] flex items-center justify-center">
                    {/* The Frame/UI */}
                    <img
                        src="https://raw.githubusercontent.com/levim67/slingshot-survival-assets/main/loading%20ui.png"
                        alt="Loading UI"
                        className="absolute inset-0 w-full h-full object-contain pointer-events-none z-20"
                    />

                    {/* The Fill Bar */}
                    <div className="absolute top-[15%] bottom-[15%] left-[3%] right-[3%] z-10 overflow-hidden rounded-full bg-slate-900/50">
                        <div
                            className="h-full bg-gradient-to-r from-orange-500 to-yellow-400 transition-all ease-linear"
                            style={{ width: `${progress}%` }}
                        />
                    </div>

                    {/* Text percentage */}
                    <div className="absolute z-30 font-black text-white text-lg drop-shadow-md pb-1">
                        {Math.floor(progress)}%
                    </div>
                </div>

                {/* Start Button - Appears when ready */}
                <div className={`transition-all duration-500 transform ${isReady ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-90'}`}>
                    <button
                        onClick={onComplete}
                        className="relative group transition-transform active:scale-95 focus:outline-none"
                    >
                        <img
                            src="https://raw.githubusercontent.com/levim67/slingshot-survival-assets/main/start%20button.png"
                            alt="Start Game"
                            className="w-64 hover:brightness-110 drop-shadow-2xl"
                        />
                    </button>
                </div>

            </div>
        </div>
    );
};

export default LoadingScreen;
