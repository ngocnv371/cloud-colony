


import React, { forwardRef } from 'react';
import { Structure, Pawn, StructureDefinition, Preset } from '../types';
import { STRUCTURES, MAP_SIZE, TERRAIN_DEFINITIONS } from '../constants';
import { Hammer } from 'lucide-react';
import { getPawnIcon, getCropIcon, getMapStructureIcon, getOverlayIcon } from '../utils/iconUtils';
import { useGame } from '../store/gameStore';

interface GameMapProps {
    structures: Structure[];
    pawns: Pawn[];
    onTileClick: (x: number, y: number) => void;
    onTileEnter: (x: number, y: number) => void;
    onMouseDown: () => void;
    selectedPawnId: string | null;
    selectedStructureId: string | null;
    buildPreview: StructureDefinition | null;
    commandMode: 'HARVEST' | 'CHOP' | 'MINE' | null;
    dragStart: { x: number, y: number } | null;
    hoverPos: { x: number, y: number } | null;
    setHoverPos: (pos: { x: number, y: number } | null) => void;
    queuedTargets: Map<string, string>;
}

const TILE_SIZE = 48; // px

const mapStyle = {
    width: MAP_SIZE * TILE_SIZE,
    height: MAP_SIZE * TILE_SIZE,
};
const GameMap = forwardRef<HTMLDivElement, GameMapProps>(({
    structures,
    pawns,
    onTileClick,
    onTileEnter,
    onMouseDown,
    selectedPawnId,
    selectedStructureId,
    buildPreview,
    commandMode,
    dragStart,
    hoverPos,
    setHoverPos,
    queuedTargets
}, ref) => {

    const { state } = useGame();
    const { terrain, presetMode } = state;
    const cursorClass = commandMode ? 'cursor-crosshair' : (buildPreview || presetMode ? 'cursor-cell' : 'cursor-auto');

    // Sort structures by layer for correct Z-index rendering
    const sortedStructures = [...structures].sort((a, b) => {
        const layerA = STRUCTURES[a.type]?.layer || 0;
        const layerB = STRUCTURES[b.type]?.layer || 0;
        return layerA - layerB;
    });

    return (
        <div ref={ref} className={`overflow-auto flex-1 bg-stone-900 flex justify-center items-center p-8 ${cursorClass}`}>
            <div
                className="relative shadow-2xl border-4 border-stone-700 bg-black"
                style={mapStyle}
                onMouseLeave={() => setHoverPos(null)}
                onMouseDown={onMouseDown}
            >
                {/* 1. Terrain Layer (Layer 0) */}
                {Array.from({ length: MAP_SIZE * MAP_SIZE }).map((_, i) => {
                    const x = i % MAP_SIZE;
                    const y = Math.floor(i / MAP_SIZE);
                    const tType = terrain[i];
                    const tDef = TERRAIN_DEFINITIONS[tType];
                    
                    return (
                        <div
                            key={`tile-${i}`}
                            className={`absolute transition-colors ${tDef.color}`}
                            style={{
                                left: x * TILE_SIZE,
                                top: y * TILE_SIZE,
                                width: TILE_SIZE,
                                height: TILE_SIZE,
                            }}
                        />
                    );
                })}

                {/* Grid Overlay */}
                <div
                    className="absolute inset-0 pointer-events-none opacity-10"
                    style={{
                        backgroundImage: `linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)`,
                        backgroundSize: `${TILE_SIZE}px ${TILE_SIZE}px`
                    }}
                />

                {/* Interactive Hitbox Layer (Invisible, on top of terrain, below structures) */}
                {Array.from({ length: MAP_SIZE * MAP_SIZE }).map((_, i) => {
                    const x = i % MAP_SIZE;
                    const y = Math.floor(i / MAP_SIZE);
                    return (
                        <div
                            key={`hitbox-${i}`}
                            className="absolute hover:bg-white/10"
                            style={{
                                left: x * TILE_SIZE,
                                top: y * TILE_SIZE,
                                width: TILE_SIZE,
                                height: TILE_SIZE,
                                zIndex: 5 
                            }}
                            onClick={() => onTileClick(x, y)}
                            onMouseEnter={() => onTileEnter(x, y)}
                        />
                    );
                })}

                {/* 2. Structures (Layer 1 - 5) */}
                {sortedStructures.map(struct => {
                    const def = STRUCTURES[struct.type];
                    if (!def) return null;
                    const isSelected = selectedStructureId === struct.id;

                    // Calculate scale based on growth for natural structures
                    let scale = 1;
                    if ((struct.type === 'TREE' || struct.type === 'BERRY_BUSH') && struct.growth !== undefined) {
                        scale = 0.4 + (struct.growth / 100) * 0.6;
                    }
                    
                    // Z-Index strategy: Base z-index on layer + Y position for slight depth sorting
                    // Layer 1 (Floors) should stay below Layer 5
                    // Layer 5 structures should sort by Y to fake 3D occlusion
                    const baseZ = def.layer * 10; 
                    const depthZ = def.layer === 5 ? struct.y : 0; 
                    const finalZ = baseZ + depthZ;

                    return (
                        <div
                            key={struct.id}
                            className={`absolute flex items-center justify-center transition-all pointer-events-none
                        ${def.color} ${isSelected ? 'border-4 border-white' : (def.layer === 5 ? 'border border-stone-800' : '')}
                        ${struct.isBlueprint ? 'opacity-60 border-2 border-dashed border-blue-300' : ''}
                    `}
                            style={{
                                left: struct.x * TILE_SIZE,
                                top: struct.y * TILE_SIZE,
                                width: def.width * TILE_SIZE,
                                height: def.height * TILE_SIZE,
                                transform: `scale(${scale})`,
                                zIndex: finalZ
                            }}
                        >
                            {/* Icons */}
                            {getMapStructureIcon(struct)}

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

                            {/* Queued Job Overlay */}
                            {queuedTargets.has(struct.id) && !struct.currentActivity && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-20">
                                    {getOverlayIcon(queuedTargets.get(struct.id)!)}
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

                {/* Pawns (Z-Index above everything usually, or sorted with objects) */}
                {pawns.map(pawn => {
                    const isSelected = selectedPawnId === pawn.id;
                    const isDead = pawn.status === 'Dead';
                    return (
                        <div
                            key={pawn.id}
                            className={`absolute rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ease-linear pointer-events-none
                        ${isDead ? 'bg-gray-700 grayscale' : pawn.color} 
                        ${isSelected ? 'ring-4 ring-yellow-400 scale-110' : ''}
                    `}
                            style={{
                                left: pawn.x * TILE_SIZE,
                                top: pawn.y * TILE_SIZE,
                                width: TILE_SIZE * 0.8,
                                height: TILE_SIZE * 0.8,
                                transform: 'translate(10%, 10%)',
                                zIndex: 100 // Always on top for now
                            }}
                        >
                            <div className="flex flex-col items-center">
                                {getPawnIcon(pawn, 20)}
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
                            zIndex: 200
                        }}
                    />
                )}

                {/* Preset Preview */}
                {presetMode && hoverPos && (
                    <div className="absolute pointer-events-none z-[200]">
                        {presetMode.items.map((item, i) => {
                             const def = STRUCTURES[item.type];
                             return (
                                 <div
                                    key={i}
                                    className={`absolute opacity-40 border border-dashed border-white ${def?.color || 'bg-white'}`}
                                    style={{
                                        left: (hoverPos.x + item.x) * TILE_SIZE,
                                        top: (hoverPos.y + item.y) * TILE_SIZE,
                                        width: (def?.width || 1) * TILE_SIZE,
                                        height: (def?.height || 1) * TILE_SIZE,
                                    }}
                                 />
                             );
                        })}
                    </div>
                )}

                {/* Command Selection Box */}
                {dragStart && hoverPos && commandMode && (
                    <div
                        className={`absolute border-2 z-[200] pointer-events-none opacity-50
                    ${commandMode === 'HARVEST' ? 'bg-green-500/30 border-green-300' : ''}
                    ${commandMode === 'CHOP' ? 'bg-orange-500/30 border-orange-300' : ''}
                    ${commandMode === 'MINE' ? 'bg-stone-500/30 border-stone-300' : ''}
                `}
                        style={{
                            left: Math.min(dragStart.x, hoverPos.x) * TILE_SIZE,
                            top: Math.min(dragStart.y, hoverPos.y) * TILE_SIZE,
                            width: (Math.abs(hoverPos.x - dragStart.x) + 1) * TILE_SIZE,
                            height: (Math.abs(hoverPos.y - dragStart.y) + 1) * TILE_SIZE,
                        }}
                    />
                )}
            </div>
        </div>
    );
});

export default GameMap;
