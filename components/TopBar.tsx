
import React from 'react';
import { Pawn } from '../types';
import { useGame } from '../store/gameStore';
import { UserRound, Hammer, Utensils, Moon, Footprints, Skull, Box } from 'lucide-react';

interface TopBarProps {
  onSelectPawn: (pawn: Pawn) => void;
}

const TopBar: React.FC<TopBarProps> = ({ onSelectPawn }) => {
  const { state } = useGame();
  const { pawns, selectedPawnId } = state;
  
  const getPawnIcon = (pawn: Pawn) => {
    if (pawn.status === 'Dead') return <Skull size={16} className="text-gray-500" />;
    
    switch(pawn.currentJob?.type) {
        case 'WORK': return <Hammer size={14} className="text-yellow-300" />;
        case 'WITHDRAW': return <Box size={14} className="text-blue-300" />;
        case 'SLEEP': return <Moon size={14} className="text-purple-300" />;
        case 'EAT': return <Utensils size={14} className="text-green-300" />;
        case 'MOVE': return <Footprints size={14} className="text-white/80" />;
        default: return <UserRound size={16} className="text-white" />;
    }
  };

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 flex gap-2 p-2 bg-gray-900/80 backdrop-blur-md border border-gray-700 rounded-lg shadow-xl overflow-x-auto max-w-[60vw] no-scrollbar">
      {pawns.map(pawn => {
        const isSelected = selectedPawnId === pawn.id;
        const isDead = pawn.status === 'Dead';
        
        const avgMood = (pawn.needs.food + pawn.needs.sleep + pawn.needs.recreation) / 3;
        let moodColor = 'bg-gray-600';
        if (!isDead) {
            if (avgMood < 30) moodColor = 'bg-red-500';
            else if (avgMood < 60) moodColor = 'bg-yellow-500';
            else moodColor = 'bg-green-500';
        }

        return (
          <button
            key={pawn.id}
            onClick={() => onSelectPawn(pawn)}
            className={`
              relative flex flex-col items-center justify-center min-w-[64px] h-16 rounded-md transition-all duration-200 border-2
              ${isSelected 
                ? 'bg-gray-700 border-yellow-400 scale-105 shadow-[0_0_10px_rgba(250,204,21,0.3)]' 
                : 'bg-gray-800/50 border-gray-700 hover:bg-gray-700 hover:border-gray-500'
              }
              ${isDead ? 'opacity-60 grayscale' : ''}
            `}
          >
            <div className="absolute top-1 right-1 w-2 h-2 rounded-full shadow-sm z-10">
                <div className={`w-full h-full rounded-full ${moodColor} ${avgMood < 30 && !isDead ? 'animate-ping' : ''}`} />
                <div className={`absolute inset-0 rounded-full ${moodColor}`} />
            </div>

            <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 ${pawn.color} shadow-sm border border-black/20`}>
                {getPawnIcon(pawn)}
            </div>

            <span className="text-[10px] font-bold text-gray-200 truncate max-w-[56px] leading-tight">
                {pawn.name}
            </span>
          </button>
        );
      })}
      
      {pawns.length === 0 && (
          <div className="text-xs text-gray-500 px-4 py-2 italic">
              No Colonists
          </div>
      )}
    </div>
  );
};

export default TopBar;
