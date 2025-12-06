
import React, { useState } from 'react';
import { STRUCTURES } from '../constants';
import { useGame } from '../store/gameStore';
import { Activity, Briefcase, Construction, Sprout, Axe, Pickaxe, Scissors, CheckCircle } from 'lucide-react';
import PawnDetails from './PawnDetails';
import { StructureDefinition, SkillType } from '../types';
import { CONSTRUCT_ACTIVITY_ID, HARVEST_ACTIVITY_ID } from '../constants';
import { getUiStructureIcon } from '../utils/iconUtils';

interface SidebarProps {
  onGeneratePawn: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onGeneratePawn }) => {
  const { state, dispatch } = useGame();
  const { selectedPawnId, selectedStructureId, buildMode, commandMode, isGeneratingPawn, pawns, structures } = state;

  const [repeatCount, setRepeatCount] = useState<number>(1);

  const selectedPawn = pawns.find(p => p.id === selectedPawnId);
  const selectedStructure = structures.find(s => s.id === selectedStructureId);
  const structureDef = selectedStructure ? STRUCTURES[selectedStructure.type] : null;

  const handleSetBuildMode = (def: StructureDefinition | null) => {
      dispatch({ type: 'SET_BUILD_MODE', def });
  };

  const handleSetCommandMode = (mode: 'HARVEST' | 'CHOP' | 'MINE' | null) => {
      dispatch({ type: 'SET_COMMAND_MODE', mode });
  };

  const handleOrderJob = (structureId: string, activityId: string, count: number) => {
      dispatch({ 
          type: 'ORDER_JOB', 
          pawnId: selectedPawnId, 
          structureId, 
          activityId, 
          count 
      });
  };

  return (
    <div className="w-96 bg-gray-800 border-l border-gray-700 flex flex-col h-full overflow-hidden shadow-xl z-[500]">
        
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
                {getUiStructureIcon(def)}
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
           <PawnDetails pawn={selectedPawn} />
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
                            onClick={() => handleOrderJob(selectedStructure.id, CONSTRUCT_ACTIVITY_ID, 1)}
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
                                if (selectedStructure.type === 'FARM_PLOT') {
                                    const hasCrop = selectedStructure.crop && selectedStructure.crop.planted;
                                    const isMature = selectedStructure.crop && selectedStructure.crop.growth >= 100;
                                    
                                    if (act.id === HARVEST_ACTIVITY_ID) return hasCrop && isMature;
                                    if (act.id.startsWith('plant_')) return !hasCrop;
                                }
                                if (selectedStructure.growth !== undefined) {
                                    if (act.actionType === 'GATHER') {
                                        if (selectedStructure.type === 'BERRY_BUSH' && selectedStructure.growth < 80) return false;
                                    }
                                }
                                return true;
                            })
                            .map((act) => {
                                let canDo = false;
                                let reason = "";
                                
                                if (!selectedPawn) {
                                    canDo = true;
                                } else {
                                    const skillLevel = selectedPawn.skills[act.requiredSkill];
                                    if (skillLevel < act.requiredLevel) {
                                        reason = `Need ${act.requiredSkill} ${act.requiredLevel}`;
                                    } else if (selectedPawn.status === 'Dead') {
                                        reason = "Pawn is dead";
                                    } else if (selectedPawn.status !== 'Idle' && selectedPawn.status !== 'Moving' && selectedPawn.status !== 'Working') {
                                        reason = "Pawn is busy";
                                        canDo = true;
                                    } else {
                                        canDo = true;
                                    }
                                }

                                return (
                                    <button
                                        key={act.id}
                                        disabled={!canDo && !!selectedPawn && selectedPawn.status !== 'Dead'} 
                                        onClick={() => handleOrderJob(selectedStructure.id, act.id, repeatCount)}
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
