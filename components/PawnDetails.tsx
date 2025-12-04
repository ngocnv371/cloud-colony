import React from 'react';
import { Pawn, SkillType } from '../types';
import { getLevelRequirement } from '../constants';
import { Skull, Utensils, Moon, Heart, Hourglass } from 'lucide-react';

interface PawnDetailsProps {
    pawn: Pawn;
}

const PawnDetails: React.FC<PawnDetailsProps> = ({ pawn }) => {
    return (
        <section className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
             <div className="flex justify-between items-start mb-4">
                <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        {pawn.status === 'Dead' && <Skull size={18} className="text-gray-400"/>}
                        {pawn.name}
                    </h2>
                    <p className="text-xs text-gray-400 italic">{pawn.backstory}</p>
                </div>
                <div className={`w-8 h-8 rounded-full ${pawn.status === 'Dead' ? 'bg-gray-600 grayscale' : pawn.color} shadow-sm border-2 border-gray-500`}></div>
             </div>

             <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                    <span className="text-gray-400">State:</span>
                    <span className={`font-mono ${pawn.status === 'Dead' ? 'text-red-500 font-bold' : 'text-yellow-400'}`}>
                        {pawn.status}
                    </span>
                </div>
                {pawn.currentJob && (
                    <div className="bg-black/30 p-2 rounded text-xs text-gray-300 space-y-1">
                        <div>Doing: {pawn.currentJob.type}</div>
                        {pawn.currentJob.type === 'WITHDRAW' && (
                             <div className="text-blue-300">Fetching Ingredients...</div>
                        )}
                    </div>
                )}
             </div>

             {/* EFFECTS */}
             {pawn.status !== 'Dead' && pawn.effects && pawn.effects.length > 0 && (
                 <div className="mb-4 space-y-1">
                     <h3 className="text-xs font-semibold text-gray-400 uppercase">Status Effects</h3>
                     <div className="flex flex-wrap gap-1">
                         {pawn.effects.map((eff, i) => (
                             <div 
                                key={i} 
                                className={`text-[10px] px-2 py-1 rounded flex items-center gap-1 border
                                    ${eff.isPositive ? 'bg-green-900/40 border-green-700 text-green-200' : 'bg-red-900/40 border-red-700 text-red-200'}
                                `}
                             >
                                 {eff.label}
                                 {eff.duration !== -1 && (
                                     <span className="text-[9px] opacity-70 flex items-center ml-1">
                                         <Hourglass size={8} /> {Math.ceil(eff.duration / 4)}s
                                     </span>
                                 )}
                             </div>
                         ))}
                     </div>
                 </div>
             )}

             {/* NEEDS BARS */}
             <div className="mb-4 space-y-2 border-b border-gray-600 pb-4">
                <h3 className="text-xs font-semibold text-gray-400 uppercase">Needs</h3>
                {pawn.needs && (
                    <>
                        {/* Food */}
                        <div className="w-full">
                            <div className="flex justify-between text-[10px] mb-1">
                                <span className="text-gray-300 flex items-center gap-1"><Utensils size={10} /> Food</span>
                                <span className="font-mono">{Math.floor(pawn.needs.food)}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full ${pawn.needs.food < 15 ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} 
                                    style={{ width: `${pawn.needs.food}%` }}
                                ></div>
                            </div>
                        </div>

                        {/* Sleep */}
                        <div className="w-full">
                            <div className="flex justify-between text-[10px] mb-1">
                                <span className="text-gray-300 flex items-center gap-1"><Moon size={10} /> Rest</span>
                                <span className="font-mono">{Math.floor(pawn.needs.sleep)}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full ${pawn.needs.sleep < 10 ? 'bg-red-500 animate-pulse' : 'bg-blue-400'}`} 
                                    style={{ width: `${pawn.needs.sleep}%` }}
                                ></div>
                            </div>
                        </div>

                        {/* Recreation */}
                        <div className="w-full">
                            <div className="flex justify-between text-[10px] mb-1">
                                <span className="text-gray-300 flex items-center gap-1"><Heart size={10} /> Recreation</span>
                                <span className="font-mono">{Math.floor(pawn.needs.recreation)}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full ${pawn.needs.recreation < 20 ? 'bg-red-500 animate-pulse' : 'bg-pink-400'}`} 
                                    style={{ width: `${pawn.needs.recreation}%` }}
                                ></div>
                            </div>
                        </div>
                    </>
                )}
             </div>
             
             <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Skills</h3>
             <div className="space-y-2">
                {Object.entries(pawn.skills).map(([skill, level]) => {
                    const typedSkill = skill as SkillType;
                    const xp = pawn.skillXp?.[typedSkill] || 0;
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
                {pawn.inventory.length === 0 ? (
                    <p className="text-sm text-gray-500">Empty</p>
                ) : (
                    <ul className="text-sm space-y-1">
                        {pawn.inventory.map((item, idx) => (
                            <li key={idx} className="flex justify-between">
                                <span>{item.name}</span>
                                <span className="text-gray-400">x{item.quantity}</span>
                            </li>
                        ))}
                    </ul>
                )}
             </div>
           </section>
    );
}

export default PawnDetails;