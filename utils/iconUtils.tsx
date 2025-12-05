
import React from 'react';
import { 
  UserRound, Hammer, Utensils, Box, Brain, TreeDeciduous, Grape, Sprout, Wheat, Carrot, 
  Mountain, Axe, Pickaxe, Scissors, Gamepad2, Swords, Moon, Footprints, Skull, 
  BrickWall, Flame, Coins, Drumstick, Square
} from 'lucide-react';
import { Pawn, Structure, StructureDefinition } from '../types';

export const getPawnIcon = (pawn: Pawn, size: number = 20) => {
    if (pawn.status === 'Dead') return <Skull size={size} className="text-gray-400" />;

    // Adjust status icon size relative to base size
    const statusSize = size > 16 ? size - 4 : size - 2;

    switch (pawn.currentJob?.type) {
        case 'WORK': return <Hammer size={statusSize} className="text-yellow-300 animate-pulse" />;
        case 'WITHDRAW': return <Box size={statusSize} className="text-blue-300" />;
        case 'SLEEP': return <Moon size={statusSize} className="text-purple-300" />;
        case 'EAT': return <Utensils size={statusSize} className="text-green-300" />;
        case 'MOVE': return <Footprints size={statusSize} className="text-white/80" />;
        default: return <UserRound size={size} className="text-white" />;
    }
};

export const getCropIcon = (type: string, growth: number) => {
    const isMature = growth >= 100;
    const className = isMature ? "text-yellow-300 drop-shadow-md" : "text-green-400 opacity-80";

    if (growth < 30) return <Sprout size={16} className="text-green-300" />;

    switch (type) {
        case 'CORN': return <Wheat size={isMature ? 24 : 18} className={className} />;
        case 'POTATO': return <Carrot size={isMature ? 24 : 18} className={className} />;
        default: return <Grape size={isMature ? 24 : 18} className={className} />;
    }
};

export const getMapStructureIcon = (struct: Structure) => {
    switch (struct.type) {
        case 'CAMPFIRE': return <Utensils size={24} className="text-white opacity-80" />;
        case 'RESEARCH_BENCH': return <Brain size={24} className="text-white opacity-80" />;
        case 'WORKBENCH': return <Hammer size={24} className="text-white opacity-80" />;
        case 'CHEST': return <Box size={24} className="text-white opacity-80" />;
        case 'CHESS_TABLE': return <Gamepad2 size={24} className="text-white opacity-80" />;
        case 'WOODEN_POLE': return <Swords size={24} className="text-white opacity-80" />;
        case 'TREE': return <TreeDeciduous size={32} className="text-green-300 opacity-90" />;
        case 'BERRY_BUSH': return <Grape size={24} className="text-red-300 opacity-90" />;
        case 'BOULDER': return <Mountain size={28} className="text-stone-300 opacity-90" />;
        case 'STEEL_VEIN': return <Mountain size={28} className="text-blue-300 opacity-90" />;
        case 'SILVER_VEIN': return <Mountain size={28} className="text-gray-200 opacity-90 drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]" />;
        case 'GOLD_VEIN': return <Mountain size={28} className="text-yellow-400 opacity-90 drop-shadow-[0_0_5px_rgba(250,204,21,0.5)]" />;
        case 'URANIUM_VEIN': return <Mountain size={28} className="text-emerald-400 opacity-90 drop-shadow-[0_0_5px_rgba(52,211,153,0.5)]" />;
        default: return null;
    }
};

export const getUiStructureIcon = (def: StructureDefinition) => {
    const size = 24;
    switch(def.type) {
        case 'WOOD_WALL': return <BrickWall size={size} className="text-amber-600" />;
        case 'STONE_WALL': return <BrickWall size={size} className="text-stone-400" />;
        case 'STEEL_WALL': return <BrickWall size={size} className="text-slate-400" />;
        case 'CAMPFIRE': return <Flame size={size} className="text-orange-500" />;
        case 'BUTCHER_TABLE': return <Utensils size={size} className="text-red-400" />;
        case 'RESEARCH_BENCH': return <Brain size={size} className="text-blue-400" />;
        case 'WORKBENCH': return <Hammer size={size} className="text-amber-500" />;
        case 'CHESS_TABLE': return <Gamepad2 size={size} className="text-gray-300" />;
        case 'WOODEN_POLE': return <Swords size={size} className="text-amber-300" />;
        case 'CHEST': return <Box size={size} className="text-amber-700" />;
        case 'FARM_PLOT': return <Sprout size={size} className="text-green-500" />;
        default: return <Square size={size} className="text-gray-500" />;
    }
};

export const getOverlayIcon = (activityId: string) => {
    if (activityId.includes('chop')) return <Axe size={24} className="text-orange-400 drop-shadow-md animate-pulse" />;
    if (activityId.includes('mine')) return <Pickaxe size={24} className="text-stone-300 drop-shadow-md animate-pulse" />;
    if (activityId.includes('harvest')) return <Scissors size={24} className="text-green-400 drop-shadow-md animate-pulse" />;
    return null;
};

export const getResourceIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('meat') || lower.includes('meal')) return <Drumstick size={14} className="text-orange-400" />;
    if (lower.includes('rice') || lower.includes('potato') || lower.includes('corn') || lower.includes('berry')) return <Wheat size={14} className="text-yellow-400" />;
    if (lower.includes('wood')) return <Box size={14} className="text-amber-600" />;
    if (lower.includes('stone') || lower.includes('boulder')) return <Mountain size={14} className="text-stone-400" />;
    if (lower.includes('steel')) return <Hammer size={14} className="text-blue-300" />;
    if (lower.includes('gold') || lower.includes('silver') || lower.includes('uranium')) return <Coins size={14} className="text-yellow-200" />;
    return <Box size={14} className="text-gray-500" />;
};
