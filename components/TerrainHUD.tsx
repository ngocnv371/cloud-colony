
import React from 'react';
import { TerrainType, Structure } from '../types';
import { TERRAIN_DEFINITIONS, STRUCTURES, MAP_SIZE } from '../constants';
import { Footprints, Map as MapIcon } from 'lucide-react';

interface TerrainHUDProps {
  hoverPos: { x: number, y: number } | null;
  terrain: TerrainType[];
  structures: Structure[];
}

const TerrainHUD: React.FC<TerrainHUDProps> = ({ hoverPos, terrain, structures }) => {
  if (!hoverPos) return null;
  
  if (hoverPos.x < 0 || hoverPos.x >= MAP_SIZE || hoverPos.y < 0 || hoverPos.y >= MAP_SIZE) return null;

  const idx = hoverPos.y * MAP_SIZE + hoverPos.x;
  const terrainType = terrain[idx];
  const terrainDef = TERRAIN_DEFINITIONS[terrainType];

  if (!terrainDef) return null;

  // Check for floor (Layer 1)
  const floor = structures.find(s => s.x === hoverPos.x && s.y === hoverPos.y && STRUCTURES[s.type]?.layer === 1);
  const floorDef = floor ? STRUCTURES[floor.type] : null;

  let speedMult = terrainDef.speedMult;
  let label = terrainDef.label;
  let subLabel = "";

  if (floorDef) {
      if (floorDef.walkSpeedMultiplier) {
          speedMult *= floorDef.walkSpeedMultiplier;
      }
      subLabel = label; 
      label = floorDef.name;
  }

  const speedPercent = Math.round(speedMult * 100);
  let speedColor = "text-gray-400";
  if (speedPercent < 100) speedColor = "text-red-400";
  if (speedPercent > 100) speedColor = "text-green-400";

  return (
    <div className="absolute bottom-4 right-[25rem] bg-gray-900/90 backdrop-blur-md border border-gray-700 p-3 rounded-lg shadow-xl z-[500] pointer-events-none min-w-[160px] animate-fade-in transition-all">
       <div className="flex items-start justify-between border-b border-gray-700 pb-2 mb-2">
            <div>
                <h3 className="text-xs font-bold text-gray-200 flex items-center gap-2">
                     <MapIcon size={14} className="text-blue-400" />
                     {label}
                </h3>
                {subLabel && <p className="text-[10px] text-gray-500 italic">on {subLabel}</p>}
            </div>
            <span className="text-[10px] font-mono text-gray-500">
                {hoverPos.x}, {hoverPos.y}
            </span>
       </div>
       
       <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400 flex items-center gap-1">
                <Footprints size={12} /> Walk Speed
            </span>
            <span className={`font-mono font-bold ${speedColor}`}>
                {speedPercent}%
            </span>
       </div>
    </div>
  );
};

export default TerrainHUD;
