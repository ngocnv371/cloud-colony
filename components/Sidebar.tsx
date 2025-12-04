
import React, { useState } from 'react';
import { Pawn, Structure, StructureDefinition, SkillType, ActivityDefinition } from '../types';
import { STRUCTURES, CONSTRUCT_ACTIVITY_ID } from '../constants';
import { X, CheckCircle, Activity, Briefcase, Construction, Package } from 'lucide-react';

interface SidebarProps {
  selectedPawn: Pawn | undefined;
  selectedStructure: Structure | undefined;
  onOrderJob: (pawnId: string, structureId: string, activityId: string, count: number) => void;
  buildMode: StructureDefinition | null;
  setBuildMode: (def: StructureDefinition | null) => void;
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
  pawns,
  isGeneratingPawn,
  onGeneratePawn
}) => {
  
  const structureDef = selectedStructure ? STRUCTURES[selectedStructure.type] : null;
  const [repeatCount, setRepeatCount] = useState<number>(1);

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
        
        {/* Build Menu */}
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Architect</h2>
          <div className="grid grid-cols-3 gap-2">
            {Object.values(STRUCTURES).filter(def => !def.isNatural).map(def => (
              <button
                key={def.type}
                onClick={() => setBuildMode(buildMode?.type === def.type ? null : def)}
                className={`relative p-2 rounded border text-xs font-medium flex flex-col items-center gap-2 transition-all group
                  ${buildMode?.type === def.type 
                    ? 'bg-blue-600 border-blue-400 text-white shadow-lg scale-105' 
                    : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                  }
                `}
              >
                <div className={`w-6 h-6 rounded ${def.color}`}></div>
                {def.name}
                
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
             
             <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Skills</h3>
             <div className="space-y-1">
                {Object.entries(selectedPawn.skills).map(([skill, level]) => (
                    <div key={skill} className="flex items-center justify-between text-sm">
                        <span className="capitalize">{skill.toLowerCase()}</span>
                        <div className="flex items-center gap-2">
                            <div className="w-24 h-1.5 bg-gray-600 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-green-500" 
                                    style={{ width: `${(Number(level) / 20) * 100}%` }}
                                ></div>
                            </div>
                            <span className="w-4 text-right font-mono text-gray-300">{level as number}</span>
                        </div>
                    </div>
                ))}
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
                        {!selectedStructure.isBlueprint && (
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
                            onClick={() => selectedPawn && onOrderJob(selectedPawn.id, selectedStructure.id, CONSTRUCT_ACTIVITY_ID, 1)}
                            disabled={!selectedPawn}
                            className={`w-full p-3 rounded text-left flex justify-between items-center group transition-colors border border-dashed
                                ${!selectedPawn ? 'opacity-50 cursor-not-allowed bg-gray-800' : 'bg-blue-900/40 hover:bg-blue-800 border-blue-500 text-blue-100'}
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
                        // Standard Activities
                        structureDef.activities.length > 0 ? structureDef.activities.map((act) => {
                            let canDo = false;
                            let reason = "";
                            
                            if (!selectedPawn) {
                                reason = "Select a pawn first";
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
                                    disabled={!selectedPawn || (!canDo && !reason.includes("busy"))} 
                                    onClick={() => selectedPawn && onOrderJob(selectedPawn.id, selectedStructure.id, act.id, repeatCount)}
                                    className={`w-full p-2 rounded text-left flex justify-between items-center group transition-colors relative
                                        ${(!selectedPawn || !canDo) 
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
