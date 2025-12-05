
import React, { forwardRef } from 'react';
import { Structure, Pawn, StructureDefinition } from '../types';
import { STRUCTURES, MAP_SIZE } from '../constants';
import { Hammer } from 'lucide-react';
import { getPawnIcon, getCropIcon, getMapStructureIcon, getOverlayIcon } from '../utils/iconUtils';

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


    const cursorClass = commandMode ? 'cursor-crosshair' : (buildPreview ? 'cursor-cell' : 'cursor-auto');

    return (
        <div ref={ref} className={`overflow-auto flex-1 bg-stone-900 flex justify-center items-center p-8 ${cursorClass}`}>
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

                    // Calculate scale based on growth for natural structures
                    let scale = 1;
                    if ((struct.type === 'TREE' || struct.type === 'BERRY_BUSH') && struct.growth !== undefined) {
                        // Map 0-100 to 0.4-1.0 scale
                        scale = 0.4 + (struct.growth / 100) * 0.6;
                    }

                    return (
                        <div
                            key={struct.id}
                            className={`absolute flex items-center justify-center transition-all pointer-events-none
                        ${def.color} ${isSelected ? 'border-4 border-white z-10' : 'border border-stone-800'}
                        ${struct.isBlueprint ? 'opacity-60 border-2 border-dashed border-blue-300' : ''}
                    `}
                            style={{
                                left: struct.x * TILE_SIZE,
                                top: struct.y * TILE_SIZE,
                                width: def.width * TILE_SIZE,
                                height: def.height * TILE_SIZE,
                                transform: `scale(${scale})`, // Apply growth scaling
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

                {/* Pawns */}
                {pawns.map(pawn => {
                    const isSelected = selectedPawnId === pawn.id;
                    const isDead = pawn.status === 'Dead';
                    return (
                        <div
                            key={pawn.id}
                            className={`absolute rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ease-linear pointer-events-none
                        ${isDead ? 'bg-gray-700 grayscale' : pawn.color} 
                        ${isSelected ? 'ring-4 ring-yellow-400 z-30 scale-110' : 'z-20'}
                    `}
                            style={{
                                left: pawn.x * TILE_SIZE,
                                top: pawn.y * TILE_SIZE,
                                width: TILE_SIZE * 0.8,
                                height: TILE_SIZE * 0.8,
                                transform: 'translate(10%, 10%)' // Center in tile
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
                        }}
                    />
                )}

                {/* Command Selection Box */}
                {dragStart && hoverPos && commandMode && (
                    <div
                        className={`absolute border-2 z-50 pointer-events-none opacity-50
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
