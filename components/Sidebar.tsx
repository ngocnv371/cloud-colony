

import React, { useState } from 'react';
import { Pawn, Structure, StructureDefinition, SkillType, ActivityDefinition } from '../types';
import { STRUCTURES, CONSTRUCT_ACTIVITY_ID, HARVEST_ACTIVITY_ID, getLevelRequirement } from '../constants';
import { X, CheckCircle, Activity, Briefcase, Construction, Package, Sprout, Axe, Pickaxe, Scissors, BrickWall, Flame, Utensils, Brain, Hammer, Gamepad2, Swords, Box, Square, Moon, Heart } from 'lucide-react';

interface SidebarProps {
  selectedPawn: Pawn | undefined;
  selectedStructure: Structure | undefined;
  onOrderJob: (pawnId: string | null, structureId: string, activityId: string, count: number) => void;
  buildMode: StructureDefinition | null;
  setBuildMode: (def: StructureDefinition | null) => void;
  commandMode: 'HARVEST' | 'CHOP' | 'MINE' | null;
  setCommandMode: (mode: 'HARVEST' | 'CHOP' | 'MINE' | null) => void;
  pawns: Pawn[];
  isGeneratingPawn: boolean;
  onGeneratePawn: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  selectedPawn, 
  selectedStructure, 
  onOrderJob,
  buildMode,
  setBuildMode,
  commandMode,
  setCommandMode,
  pawns,
  isGeneratingPawn,
  onGeneratePawn
}) => {
  
  const structureDef = selectedStructure ? STRUCTURES[selectedStructure.type] : null;
  const [repeatCount, setRepeatCount] = useState<number>(1);

  const handleSetBuildMode = (def: StructureDefinition | null) => {
      setBuildMode(def);
      if (def) setCommandMode(null);
  };

  const handleSetCommandMode = (mode: 'HARVEST' | 'CHOP' | 'MINE' | null) => {
      setCommandMode(mode);
      if (mode) setBuildMode(null);
  };

  const getStructureIcon = (def: StructureDefinition) => {
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

  return (
    <div className="w-96 bg-gray-800 border-l border-gray-700 flex flex-col h-full overflow-hidden shadow-xl z-30">
        
      {/* Header */}
      <div className="p-4 bg-gray-900 border-b border-gray-700">
        <h1 className="text-xl font-bold text-gray-100 flex items-center gap-2">
            <Activity className="text-blue-400" /> 
            Colony Manager
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* Orders Menu */}
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Orders</h2>
          <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleSetCommandMode(commandMode === 'HARVEST' ? null : 'HARVEST')}
                className={`p-2 rounded border text-xs font-medium flex flex-col items-center gap-2 transition-all
                  ${commandMode === 'HARVEST' 
                    ? 'bg-green-600 border-green-400 text-white shadow-lg scale-105' 
                    : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                  }
                `}
              >
                <Scissors size={20} />
                Harvest
              </button>
              <button
                onClick={() => handleSetCommandMode(commandMode === 'CHOP' ? null : 'CHOP')}
                className={`p-2 rounded border text-xs font-medium flex flex-col items-center gap-2 transition-all
                  ${commandMode === 'CHOP' 
                    ? 'bg-orange-600 border-orange-400 text-white shadow-lg scale-105' 
                    : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                  }
                `}
              >
                <Axe size={20} />
                Chop Wood
              </button>
              <button
                onClick={() => handleSetCommandMode(commandMode === 'MINE' ? null : 'MINE')}
                className={`p-2 rounded border text-xs font-medium flex flex-col items-center gap-2 transition-all
                  ${commandMode === 'MINE' 
                    ? 'bg-stone-600 border-stone-400 text-white shadow-lg scale-105' 
                    : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                  }
                `}
              >
                <Pickaxe size={20} />
                Mine
              </button>
          </div>
          <p className="text-[10px] text-gray-500 mt-2 text-center italic">
              Select an order and drag across the map to tag objects.
          </p>
        </section>

        {/* Build Menu */}
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Architect</h2>
          <div className="grid grid-cols-3 gap-2">
            {Object.values(STRUCTURES).filter(def => !def.isNatural).map(def => (
              <button
                key={def.type}
                onClick={() => handleSetBuildMode(buildMode?.type === def.type ? null : def)}
                className={`relative p-2 rounded border text-xs font-medium flex flex-col items-center gap-2 transition-all group
                  ${buildMode?.type === def.type 
                    ? 'bg-blue-600 border-blue-400 text-white shadow-lg scale-105' 
                    : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                  }
                `}
              >
                {getStructureIcon(def)}
                <span className="text-center leading-tight">{def.name}</span>
                
                {/* Cost Tooltip */}
                <div className="absolute bottom-full mb-2 hidden group-hover:block bg-black text-white p-2 rounded z-50 whitespace-nowrap border border-gray-600">
                    <p className="font-bold border-b border-gray-600 mb-1">Cost:</p>
                    {def.cost.length > 0 ? (
                        def.cost.map((c, i) => (
                            <div key={i} className="flex justify-between gap-4">
                                <span>{c.itemName}</span>
                                <span>x{c.amount}</span>
                            </div>
                        ))
                    ) : (
                        <span>Free</span>
                    )}
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Selected Pawn Panel */}
        {selectedPawn ? (
           <section className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
             <div className="flex justify-between items-start mb-4">
                <div>
                    <h2 className="text-lg font-bold text-white">{selectedPawn.name}</h2>
                    <p className="text-xs text-gray-400 italic">{selectedPawn.backstory}</p>
                </div>
                <div className={`w-8 h-8 rounded-full ${selectedPawn.color} shadow-sm border-2 border-gray-500`}></div>
             </div>

             <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                    <span className="text-gray-400">State:</span>
                    <span className="text-yellow-400 font-mono">{selectedPawn.status}</span>
                </div>
                {selectedPawn.currentJob && (
                    <div className="bg-black/30 p-2 rounded text-xs text-gray-300 space-y-1">
                        <div>Doing: {selectedPawn.currentJob.type}</div>
                        {selectedPawn.currentJob.type === 'WITHDRAW' && (
                             <div className="text-blue-300">Fetching Ingredients...</div>
                        )}
                    </div>
                )}
             </div>

             {/* NEEDS BARS */}
             <div className="mb-4 space-y-2 border-b border-gray-600 pb-4">
                <h3 className="text-xs font-semibold text-gray-400 uppercase">Needs</h3>
                {selectedPawn.needs && (
                    <>
                        {/* Food */}
                        <div className="w-full">
                            <div className="flex justify-between text-[10px] mb-1">
                                <span className="text-gray-300 flex items-center gap-1"><Utensils size={10} /> Food</span>
                                <span className="font-mono">{Math.floor(selectedPawn.needs.food)}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full ${selectedPawn.needs.food < 15 ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} 
                                    style={{ width: `${selectedPawn.needs.food}%` }}
                                ></div>
                            </div>
                        </div>

                        {/* Sleep */}
                        <div className="w-full">
                            <div className="flex justify-between text-[10px] mb-1">
                                <span className="text-gray-300 flex items-center gap-1"><Moon size={10} /> Rest</span>
                                <span className="font-mono">{Math.floor(selectedPawn.needs.sleep)}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full ${selectedPawn.needs.sleep < 10 ? 'bg-red-500 animate-pulse' : 'bg-blue-400'}`} 
                                    style={{ width: `${selectedPawn.needs.sleep}%` }}
                                ></div>
                            </div>
                        </div>

                        {/* Recreation */}
                        <div className="w-full">
                            <div className="flex justify-between text-[10px] mb-1">
                                <span className="text-gray-300 flex items-center gap-1"><Heart size={10} /> Recreation</span>
                                <span className="font-mono">{Math.floor(selectedPawn.needs.recreation)}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full ${selectedPawn.needs.recreation < 20 ? 'bg-red-500 animate-pulse' : 'bg-pink-400'}`} 
                                    style={{ width: `${selectedPawn.needs.recreation}%` }}
                                ></div>
                            </div>
                        </div>
                    </>
                )}
             </div>
             
             <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Skills</h3>
             <div className="space-y-2">
                {Object.entries(selectedPawn.skills).map(([skill, level]) => {
                    const typedSkill = skill as SkillType;
                    const xp = selectedPawn.skillXp?.[typedSkill] || 0;
                    const required = getLevelRequirement(level as number);
                    const percent = (xp / required) * 100;
                    
                    return (
                        <div key={skill} className="text-sm">
                            <div className="flex items-center justify-between mb-0.5">
                                <span className="capitalize text-xs text-gray-300">{skill.toLowerCase()}</span>
                                <span className="font-mono text-xs font-bold">{level as number}</span>
                            </div>
                            <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden border border-gray-600 relative">
                                {/* Level Bar (Base) - Just solid background here, we use color for value */}
                                <div 
                                    className="absolute inset-y-0 left-0 bg-gray-600 opacity-30" 
                                    style={{ width: `${(Number(level) / 20) * 100}%` }}
                                ></div>
                                {/* XP Bar (Progress) */}
                                <div 
                                    className="absolute inset-y-0 left-0 bg-yellow-400/80 transition-all duration-300"
                                    style={{ width: `${percent}%` }}
                                ></div>
                            </div>
                            <div className="flex justify-end">
                                <span className="text-[9px] text-gray-500 font-mono">{Math.floor(xp)} / {required} XP</span>
                            </div>
                        </div>
                    );
                })}
             </div>

             <div className="mt-4 pt-4 border-t border-gray-600">
                <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Inventory</h3>
                {selectedPawn.inventory.length === 0 ? (
                    <p className="text-sm text-gray-500">Empty</p>
                ) : (
                    <ul className="text-sm space-y-1">
                        {selectedPawn.inventory.map((item, idx) => (
                            <li key={idx} className="flex justify-between">
                                <span>{item.name}</span>
                                <span className="text-gray-400">x{item.quantity}</span>
                            </li>
                        ))}
                    </ul>
                )}
             </div>
           </section>
        ) : (
            <section className="bg-gray-700/30 rounded-lg p-4 text-center border border-dashed border-gray-600">
                <p className="text-gray-400 text-sm">Select a pawn to view details</p>
            </section>
        )}

        {/* Selected Structure Context Actions */}
        {selectedStructure && structureDef && (
            <section className="bg-gray-700/50 rounded-lg p-4 border border-gray-600 animate-fade-in">
                <div className="flex items-center justify-between mb-2">
                     <h2 className="text-lg font-bold text-white flex items-center gap-2">
                         {structureDef.name}
                         {selectedStructure.isBlueprint && <span className="text-xs bg-blue-600 px-2 py-0.5 rounded text-white font-mono">BLUEPRINT</span>}
                     </h2>
                </div>
                
                {/* Crop Info */}
                {selectedStructure.crop && (
                    <div className="mb-2 bg-green-900/30 border border-green-800 p-2 rounded">
                        <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-green-300 flex items-center gap-2">
                                <Sprout size={14}/> {selectedStructure.crop.type}
                            </span>
                            <span className="text-xs text-gray-300">{Math.floor(selectedStructure.crop.growth)}%</span>
                        </div>
                        <div className="w-full bg-gray-700 h-1.5 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500" style={{ width: `${selectedStructure.crop.growth}%` }}></div>
                        </div>
                        {selectedStructure.crop.growth >= 100 && (
                            <div className="text-[10px] text-yellow-300 mt-1 font-bold uppercase tracking-wider">Ready to Harvest</div>
                        )}
                    </div>
                )}

                {/* Natural Growth Info */}
                {(selectedStructure.type === 'TREE' || selectedStructure.type === 'BERRY_BUSH') && selectedStructure.growth !== undefined && (
                     <div className="mb-2 bg-green-900/30 border border-green-800 p-2 rounded">
                        <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-green-300 flex items-center gap-2">
                                <Sprout size={14}/> Growth
                            </span>
                            <span className="text-xs text-gray-300">{Math.floor(selectedStructure.growth)}%</span>
                        </div>
                        <div className="w-full bg-gray-700 h-1.5 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500" style={{ width: `${selectedStructure.growth}%` }}></div>
                        </div>
                        {selectedStructure.growth < 100 ? (
                             <div className="text-[10px] text-gray-400 mt-1 italic">Growing... (Yield: {Math.floor(selectedStructure.growth)}%)</div>
                        ) : (
                             <div className="text-[10px] text-yellow-300 mt-1 font-bold uppercase tracking-wider">Mature</div>
                        )}
                    </div>
                )}

                {/* Structure Inventory */}
                <div className="mb-4 bg-black/20 p-2 rounded">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase mb-1">Stored Items</h3>
                    {selectedStructure.inventory.length === 0 ? (
                        <p className="text-xs text-gray-500">Empty</p>
                    ) : (
                        <ul className="text-xs space-y-1 max-h-32 overflow-y-auto">
                            {selectedStructure.inventory.map((item, idx) => (
                                <li key={idx} className="flex justify-between text-gray-300">
                                    <span>{item.name}</span>
                                    <span>x{item.quantity}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-xs font-semibold text-gray-400 uppercase">Available Orders</h3>
                        {!selectedStructure.isBlueprint && selectedStructure.type !== 'FARM_PLOT' && (
                            <div className="flex items-center gap-2 text-xs">
                                <span className="text-gray-400">Repeat:</span>
                                <input 
                                    type="number" 
                                    min="1" 
                                    max="99" 
                                    value={repeatCount} 
                                    onChange={(e) => setRepeatCount(Math.max(1, parseInt(e.target.value) || 1))}
                                    className="w-12 bg-gray-900 border border-gray-600 rounded px-1 text-center"
                                />
                            </div>
                        )}
                    </div>
                    
                    {selectedStructure.isBlueprint ? (
                        // Blueprint Construction Action
                         <button
                            onClick={() => onOrderJob(selectedPawn?.id || null, selectedStructure.id, CONSTRUCT_ACTIVITY_ID, 1)}
                            className={`w-full p-3 rounded text-left flex justify-between items-center group transition-colors border border-dashed
                                bg-blue-900/40 hover:bg-blue-800 border-blue-500 text-blue-100
                            `}
                        >
                            <div className="flex flex-col">
                                <span className="font-bold flex items-center gap-2"><Construction size={16}/> Construct {structureDef.name}</span>
                                <div className="text-xs text-blue-300 mt-1">Requires: Construction Lv 0</div>
                                <div className="text-xs text-gray-400 mt-1">
                                    Needs: {structureDef.cost.map(c => `${c.amount} ${c.itemName}`).join(', ')}
                                </div>
                            </div>
                        </button>
                    ) : (
                        // Standard Activities + Farming/Growth Logic
                        structureDef.activities.length > 0 ? structureDef.activities
                            .filter(act => {
                                // Farm Logic
                                if (selectedStructure.type === 'FARM_PLOT') {
                                    const hasCrop = selectedStructure.crop && selectedStructure.crop.planted;
                                    const isMature = selectedStructure.crop && selectedStructure.crop.growth >= 100;
                                    
                                    if (act.id === HARVEST_ACTIVITY_ID) {
                                        return hasCrop && isMature;
                                    }
                                    if (act.id.startsWith('plant_')) {
                                        return !hasCrop;
                                    }
                                }
                                // Natural Growth Logic (Trees/Bushes)
                                if (selectedStructure.growth !== undefined) {
                                    if (act.actionType === 'GATHER') {
                                        // Allow Trees always (or growth > 0 implicit in existence)
                                        // Allow Berries if >= 80
                                        if (selectedStructure.type === 'BERRY_BUSH' && selectedStructure.growth < 80) return false;
                                    }
                                }

                                return true;
                            })
                            .map((act) => {
                                let canDo = false;
                                let reason = "";
                                
                                if (!selectedPawn) {
                                    // With global queue, not selecting a pawn is fine, they just get queued
                                    canDo = true;
                                } else {
                                    const skillLevel = selectedPawn.skills[act.requiredSkill];
                                    if (skillLevel < act.requiredLevel) {
                                        reason = `Need ${act.requiredSkill} ${act.requiredLevel}`;
                                    } else if (selectedPawn.status !== 'Idle' && selectedPawn.status !== 'Moving' && selectedPawn.status !== 'Working') {
                                        reason = "Pawn is busy";
                                        canDo = true; // Still allow override
                                    } else {
                                        canDo = true;
                                    }
                                }

                                return (
                                    <button
                                        key={act.id}
                                        disabled={!canDo && !!selectedPawn} 
                                        onClick={() => onOrderJob(selectedPawn?.id || null, selectedStructure.id, act.id, repeatCount)}
                                        className={`w-full p-2 rounded text-left flex justify-between items-center group transition-colors relative mb-1
                                            ${(!canDo && !!selectedPawn)
                                                ? 'opacity-50 cursor-not-allowed bg-gray-800' 
                                                : 'bg-gray-600 hover:bg-blue-600 text-white'
                                            }
                                        `}
                                    >
                                        <div>
                                            <div className="font-medium text-sm">{act.name} {repeatCount > 1 && `(x${repeatCount})`}</div>
                                            <div className="text-[10px] text-gray-300">
                                                Req: {act.requiredSkill} {act.requiredLevel}
                                            </div>
                                            {act.inputs && act.inputs.length > 0 && (
                                                <div className="text-[10px] text-yellow-200/80 mt-0.5">
                                                    Inputs: {act.inputs.map(i => `${i.quantity * repeatCount} ${i.itemName}`).join(', ')}
                                                </div>
                                            )}
                                            {reason && !canDo && (
                                                <div className="text-[10px] text-red-300">{reason}</div>
                                            )}
                                        </div>
                                        {canDo && <CheckCircle size={16} className="text-green-400 opacity-0 group-hover:opacity-100" />}
                                    </button>
                                );
                        }) : (
                             <p className="text-sm text-gray-500 italic">No activities available.</p>
                        )
                    )}
                </div>
            </section>
        )}

        {/* AI Generator */}
        <section className="pt-4 border-t border-gray-700">
             <button
                onClick={onGeneratePawn}
                disabled={isGeneratingPawn}
                className={`w-full py-3 px-4 rounded-lg font-bold shadow-lg flex items-center justify-center gap-2
                    ${isGeneratingPawn 
                        ? 'bg-purple-900/50 text-purple-300 cursor-wait' 
                        : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500'
                    }
                `}
             >
                {isGeneratingPawn ? (
                    <>Generating DNA...</>
                ) : (
                    <>
                        <Briefcase size={18} /> Recruit Wanderer (AI)
                    </>
                )}
             </button>
             <p className="text-[10px] text-gray-500 mt-2 text-center">
                 Powered by Gemini 2.5 Flash
             </p>
        </section>

      </div>
    </div>
  );
};

export default Sidebar;