
import React, { useMemo } from 'react';
import { Structure, Pawn, MAP_SIZE, StructureDefinition } from '../types';
import { STRUCTURES } from '../constants';
import { User, Hammer, Utensils, Zap, Box, Brain, TreeDeciduous, Grape, Sprout, Wheat, Carrot } from 'lucide-react';

interface GameMapProps {
  structures: Structure[];
  pawns: Pawn[];
  onTileClick: (x: number, y: number) => void;
  onTileEnter: (x: number, y: number) => void;
  onMouseDown: () => void;
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
  onTileEnter,
  onMouseDown,
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
        case 'WITHDRAW': return <Box size={16} className="text-blue-300" />;
        default: return <User size={20} className="text-white" />;
    }
  };

  const getCropIcon = (type: string, growth: number) => {
      const isMature = growth >= 100;
      const className = isMature ? "text-yellow-300 drop-shadow-md" : "text-green-400 opacity-80";
      
      if (growth < 30) return <Sprout size={16} className="text-green-300" />;
      
      switch(type) {
          case 'CORN': return <Wheat size={isMature ? 24 : 18} className={className} />;
          case 'POTATO': return <Carrot size={isMature ? 24 : 18} className={className} />; // Carrot icon as generic root veg
          default: return <Grape size={isMature ? 24 : 18} className={className} />; // Rice/Generic
      }
  };

  return (
    <div className="overflow-auto flex-1 bg-stone-900 flex justify-center items-center p-8 cursor-crosshair">
      <div 
        className="relative bg-[#3a4a35] shadow-2xl border-4 border-stone-700"
        style={mapStyle}
        onMouseLeave={() => setHoverPos(null)}
        onMouseDown={onMouseDown}
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
              onMouseEnter={() => onTileEnter(x, y)}
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
                    className={`absolute flex items-center justify-center transition-all
                        ${def.color} ${isSelected ? 'border-4 border-white z-10' : 'border border-stone-800'}
                        ${struct.isBlueprint ? 'opacity-60 border-2 border-dashed border-blue-300' : ''}
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
                    onMouseEnter={() => onTileEnter(struct.x, struct.y)}
                >
                    {/* Visual indicators for structure type */}
                    {struct.type === 'CAMPFIRE' && <Utensils size={24} className="text-white opacity-80" />}
                    {struct.type === 'RESEARCH_BENCH' && <Brain size={24} className="text-white opacity-80" />}
                    {struct.type === 'WORKBENCH' && <Hammer size={24} className="text-white opacity-80" />}
                    {struct.type === 'CHEST' && <Box size={24} className="text-white opacity-80" />}
                    {struct.type === 'TREE' && <TreeDeciduous size={32} className="text-green-300 opacity-90" />}
                    {struct.type === 'BERRY_BUSH' && <Grape size={24} className="text-red-300 opacity-90" />}
                    
                    {/* Farm Crops */}
                    {struct.type === 'FARM_PLOT' && struct.crop && struct.crop.planted && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            {getCropIcon(struct.crop.type, struct.crop.growth)}
                        </div>
                    )}

                    {/* Blueprint Label */}
                    {struct.isBlueprint && (
                        <div className="absolute inset-0 flex items-center justify-center bg-blue-900/30">
                            <Hammer size={16} className="text-blue-200 animate-pulse" />
                        </div>
                    )}

                    {/* Progress Bar for Active Job - Centered */}
                    {struct.currentActivity && (
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-1.5 bg-gray-900/80 rounded-full overflow-hidden border border-white/30 z-20 pointer-events-none">
                            <div 
                                className="h-full bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.8)] transition-all duration-200" 
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
                        ${pawn.color} ${isSelected ? 'ring-4 ring-yellow-400 z-30 scale-110' : 'z-20'}
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
