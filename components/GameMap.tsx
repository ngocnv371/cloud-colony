import React, { useMemo } from 'react';
import { Structure, Pawn, MAP_SIZE, StructureDefinition } from '../types';
import { STRUCTURES } from '../constants';
import { User, Hammer, Utensils, Zap, Box, Brain } from 'lucide-react';

interface GameMapProps {
  structures: Structure[];
  pawns: Pawn[];
  onTileClick: (x: number, y: number) => void;
  selectedPawnId: string | null;
  selectedStructureId: string | null;
  buildPreview: StructureDefinition | null;
  hoverPos: { x: number, y: number } | null;
  setHoverPos: (pos: { x: number, y: number } | null) => void;
}

const TILE_SIZE = 48; // px

const GameMap: React.FC<GameMapProps> = ({ 
  structures, 
  pawns, 
  onTileClick, 
  selectedPawnId,
  selectedStructureId,
  buildPreview,
  hoverPos,
  setHoverPos
}) => {
  
  const mapStyle = {
    width: MAP_SIZE * TILE_SIZE,
    height: MAP_SIZE * TILE_SIZE,
  };

  const getPawnIcon = (jobType?: string) => {
    switch(jobType) {
        case 'WORK': return <Hammer size={16} className="text-yellow-300 animate-pulse" />;
        default: return <User size={20} className="text-white" />;
    }
  };

  return (
    <div className="overflow-auto flex-1 bg-stone-900 flex justify-center items-center p-8 cursor-crosshair">
      <div 
        className="relative bg-[#3a4a35] shadow-2xl border-4 border-stone-700"
        style={mapStyle}
        onMouseLeave={() => setHoverPos(null)}
      >
        {/* Grid Lines (CSS Background for performance) */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-20" 
          style={{
            backgroundImage: `linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)`,
            backgroundSize: `${TILE_SIZE}px ${TILE_SIZE}px`
          }}
        />

        {/* Interactive Layer */}
        {Array.from({ length: MAP_SIZE * MAP_SIZE }).map((_, i) => {
          const x = i % MAP_SIZE;
          const y = Math.floor(i / MAP_SIZE);
          return (
            <div
              key={`${x}-${y}`}
              className="absolute hover:bg-white/10 transition-colors"
              style={{
                left: x * TILE_SIZE,
                top: y * TILE_SIZE,
                width: TILE_SIZE,
                height: TILE_SIZE,
              }}
              onClick={() => onTileClick(x, y)}
              onMouseEnter={() => setHoverPos({x, y})}
            />
          );
        })}

        {/* Structures */}
        {structures.map(struct => {
            const def = STRUCTURES[struct.type];
            if (!def) return null;
            const isSelected = selectedStructureId === struct.id;
            
            return (
                <div
                    key={struct.id}
                    className={`absolute flex items-center justify-center border transition-all
                        ${def.color} ${isSelected ? 'border-4 border-white z-10' : 'border-stone-800'}
                    `}
                    style={{
                        left: struct.x * TILE_SIZE,
                        top: struct.y * TILE_SIZE,
                        width: def.width * TILE_SIZE,
                        height: def.height * TILE_SIZE,
                    }}
                    onClick={(e) => {
                        e.stopPropagation();
                        onTileClick(struct.x, struct.y);
                    }}
                >
                    {/* Visual indicators for structure type */}
                    {struct.type === 'CAMPFIRE' && <Utensils size={24} className="text-white opacity-80" />}
                    {struct.type === 'RESEARCH_BENCH' && <Brain size={24} className="text-white opacity-80" />}
                    {struct.type === 'WORKBENCH' && <Hammer size={24} className="text-white opacity-80" />}
                    
                    {/* Progress Bar for Active Job */}
                    {struct.currentActivity && (
                        <div className="absolute -top-3 left-0 w-full h-2 bg-gray-700 rounded-full overflow-hidden border border-black">
                            <div 
                                className="h-full bg-yellow-400" 
                                style={{ width: `${struct.currentActivity.progress}%` }} 
                            />
                        </div>
                    )}
                </div>
            );
        })}

        {/* Pawns */}
        {pawns.map(pawn => {
            const isSelected = selectedPawnId === pawn.id;
            return (
                <div
                    key={pawn.id}
                    className={`absolute rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ease-linear
                        ${pawn.color} ${isSelected ? 'ring-4 ring-yellow-400 z-20 scale-110' : 'z-10'}
                    `}
                    style={{
                        left: pawn.x * TILE_SIZE,
                        top: pawn.y * TILE_SIZE,
                        width: TILE_SIZE * 0.8,
                        height: TILE_SIZE * 0.8,
                        transform: 'translate(10%, 10%)' // Center in tile
                    }}
                    onClick={(e) => {
                        e.stopPropagation();
                        onTileClick(pawn.x, pawn.y);
                    }}
                >
                    <div className="flex flex-col items-center">
                        {getPawnIcon(pawn.currentJob?.type)}
                        <span className="text-[10px] font-bold text-white drop-shadow-md truncate max-w-[40px]">
                            {pawn.name}
                        </span>
                    </div>
                </div>
            );
        })}

        {/* Build Preview */}
        {buildPreview && hoverPos && (
            <div
                className={`absolute opacity-50 border-2 border-dashed border-white pointer-events-none ${buildPreview.color}`}
                style={{
                    left: hoverPos.x * TILE_SIZE,
                    top: hoverPos.y * TILE_SIZE,
                    width: buildPreview.width * TILE_SIZE,
                    height: buildPreview.height * TILE_SIZE,
                }}
            />
        )}
      </div>
    </div>
  );
};

export default GameMap;