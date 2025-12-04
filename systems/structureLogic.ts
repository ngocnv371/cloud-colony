import { Pawn, Structure, LogEntry, SkillType } from '../types';
import { STRUCTURES, CONSTRUCT_ACTIVITY_ID, HARVEST_ACTIVITY_ID, CROPS } from '../constants';
import { addItemToInventory } from '../utils/inventoryUtils';

type LogEvent = Omit<LogEntry, 'id' | 'timestamp'>;

export const processStructures = (
    currentStructures: Structure[],
    currentPawns: Pawn[]
): { nextStructures: Structure[], nextPawns: Pawn[], logs: LogEvent[] } => {
    
    const logs: LogEvent[] = [];
    const finalPawns = [...currentPawns]; // Mutable copy for updating inventories/jobs inside loop
    
    const nextStructures = currentStructures.map(struct => {
        let nextStruct = { ...struct };

        // 0. Crop Growth
        if (nextStruct.type === 'FARM_PLOT' && nextStruct.crop && nextStruct.crop.planted && nextStruct.crop.growth < 100) {
            const cropDef = CROPS[nextStruct.crop.type];
            if (cropDef) {
                // Growth rate per tick
                nextStruct.crop = {
                    ...nextStruct.crop,
                    growth: Math.min(100, nextStruct.crop.growth + cropDef.growRate)
                };
            }
        }

        // 1. Handle Instant WITHDRAW actions from pawns at this structure
        finalPawns.forEach((pawn, pIdx) => {
            if (pawn.currentJob?.type === 'WITHDRAW' && pawn.status === 'Withdrawing' && pawn.currentJob.targetStructureId === struct.id) {
                // Transfer items
                const needed = pawn.currentJob.itemsToHandle || [];
                let withdrawnAny = false;
                needed.forEach(need => {
                    // Find item in structure
                    const itemIndex = nextStruct.inventory.findIndex(i => i.name === need.itemName);
                    if (itemIndex !== -1) {
                        const item = nextStruct.inventory[itemIndex];
                        const amountToTake = Math.min(item.quantity, need.quantity);
                        
                        if (amountToTake > 0) {
                            // Add to pawn
                            const pawnItemIndex = pawn.inventory.findIndex(pi => pi.name === need.itemName);
                            if (pawnItemIndex !== -1) {
                                finalPawns[pIdx].inventory[pawnItemIndex].quantity += amountToTake;
                            } else {
                                finalPawns[pIdx].inventory.push({ ...item, quantity: amountToTake });
                            }

                            // Remove from structure
                            item.quantity -= amountToTake;
                            if (item.quantity <= 0) {
                                nextStruct.inventory.splice(itemIndex, 1);
                            }
                            logs.push({ message: `[${pawn.name}] picked up ${amountToTake} ${need.itemName}`, type: 'info' });
                            withdrawnAny = true;
                        }
                    }
                });

                if (!withdrawnAny && needed.length > 0) {
                     logs.push({ message: `[${pawn.name}] could not find ${needed[0].itemName} in ${STRUCTURES[struct.type].name}`, type: 'warning' });
                }

                // Advance Pawn Job
                if (pawn.currentJob.nextJob) {
                    finalPawns[pIdx].currentJob = pawn.currentJob.nextJob;
                    finalPawns[pIdx].status = 'Moving'; // Assume movement next
                } else {
                    finalPawns[pIdx].currentJob = null;
                    finalPawns[pIdx].status = 'Idle';
                }
            }
        });

        // 2. Auto-initialize activity if a pawn is here to work
        if (!nextStruct.currentActivity) {
             const arrivingWorker = finalPawns.find(p => 
                p.currentJob?.type === 'WORK' && 
                p.currentJob.targetStructureId === nextStruct.id &&
                (p.status === 'Working' || p.status === 'Moving to Work')
             );

             if (arrivingWorker) {
                 // Check adjacency (Chebyshev distance <= 1)
                 const dx = arrivingWorker.x - nextStruct.x;
                 const dy = arrivingWorker.y - nextStruct.y;
                 const dist = Math.max(Math.abs(dx), Math.abs(dy));

                 if (dist <= 1) { 
                     // Start the job on the structure
                     nextStruct.currentActivity = {
                         activityId: arrivingWorker.currentJob!.activityId!,
                         progress: 0,
                         workerId: arrivingWorker.id,
                         repeatsLeft: arrivingWorker.currentJob!.activityRepeats || 1
                     };
                 }
             }
        }

        // 3. Handle Timed Activities (WORK)
        if (nextStruct.currentActivity) {
            // Find worker
            const workerIdx = finalPawns.findIndex(p => p.id === nextStruct.currentActivity?.workerId);
            const worker = finalPawns[workerIdx];
            
            // If worker is present and working
            if (worker && worker.status === 'Working' && worker.currentJob?.targetStructureId === nextStruct.id) {
                const actId = nextStruct.currentActivity.activityId;
                
                // Special case: Construct
                if (actId === CONSTRUCT_ACTIVITY_ID) {
                    // It's a blueprint being built
                    // Standardize speed: Base 20 ticks
                    const speed = 20;
                    const skillFactor = 1 + (worker.skills[SkillType.CONSTRUCTION] * 0.1);
                    const progressGain = (100 / speed) * skillFactor;
                    
                    const newProgress = Math.min(100, nextStruct.currentActivity.progress + progressGain);
                    
                    if (newProgress >= 100) {
                        // Check costs again
                        const cost = STRUCTURES[nextStruct.type].cost;
                        let canAfford = true;
                        cost.forEach(c => {
                             const idx = worker.inventory.findIndex(i => i.name === c.itemName && i.quantity >= c.amount);
                             if (idx === -1) canAfford = false;
                        });
                        
                        if (canAfford) {
                            cost.forEach(c => {
                                const idx = worker.inventory.findIndex(i => i.name === c.itemName);
                                if (idx !== -1) {
                                    worker.inventory[idx].quantity -= c.amount;
                                    if (worker.inventory[idx].quantity <= 0) worker.inventory.splice(idx, 1);
                                }
                            });

                            // Finish Construction
                            nextStruct.isBlueprint = false;
                            nextStruct.currentActivity = undefined;
                            logs.push({ message: `[${worker.name}] finished constructing ${STRUCTURES[nextStruct.type].name}`, type: 'success' });
                            
                            // Reset Worker
                            finalPawns[workerIdx].currentJob = null;
                            finalPawns[workerIdx].status = 'Idle';
                        } else {
                             logs.push({ message: `[${worker.name}] failed construction: Missing Resources`, type: 'error' });
                             finalPawns[workerIdx].currentJob = null;
                             finalPawns[workerIdx].status = 'Idle';
                        }

                    } else {
                         nextStruct.currentActivity = { ...nextStruct.currentActivity, progress: newProgress };
                    }

                } else {
                    // Normal Activity
                    const def = STRUCTURES[nextStruct.type];
                    const actDef = def.activities.find(a => a.id === actId);
                    
                    if (actDef) {
                        const skillFactor = 1 + (worker.skills[actDef.requiredSkill] * 0.1); 
                        const progressGain = (100 / actDef.durationTicks) * skillFactor;
                        const newProgress = Math.min(100, nextStruct.currentActivity.progress + progressGain);
                        
                        if (newProgress >= 100) {
                            // Finished One Cycle
                            
                            // Consume Inputs
                            if (actDef.inputs) {
                                actDef.inputs.forEach(inp => {
                                    const idx = worker.inventory.findIndex(i => i.name === inp.itemName);
                                    if (idx !== -1) {
                                        worker.inventory[idx].quantity -= inp.quantity;
                                        if (worker.inventory[idx].quantity <= 0) worker.inventory.splice(idx, 1);
                                    }
                                });
                            }

                            // Produce Outputs
                            let logMsg = `[${worker.name}] finished ${actDef.name}`;
                            // Special Handling for Farming
                            if (nextStruct.type === 'FARM_PLOT') {
                                if (actId.startsWith('plant_')) {
                                    // Planting finished
                                    const cropType = actId.split('_')[1].toUpperCase();
                                    nextStruct.crop = {
                                        type: cropType as any,
                                        growth: 0,
                                        planted: true
                                    };
                                    logMsg = `[${worker.name}] planted ${cropType}`;
                                } else if (actId === HARVEST_ACTIVITY_ID) {
                                    // Harvesting finished
                                    if (nextStruct.crop && nextStruct.crop.planted) {
                                        const cropDef = CROPS[nextStruct.crop.type];
                                        const skillLevel = worker.skills[SkillType.PLANTS] || 0;
                                        const multiplier = 0.5 + (skillLevel / 20.0) * 1.5;
                                        const yieldAmount = Math.floor(cropDef.yield * multiplier);

                                        if (yieldAmount > 0) {
                                             addItemToInventory(worker.inventory, {
                                                id: `food-${Date.now()}`,
                                                name: cropDef.name, // e.g. "Rice"
                                                quantity: yieldAmount,
                                                weight: 1
                                             });
                                             logMsg = `[${worker.name}] harvested ${yieldAmount}x ${cropDef.name}`;
                                        }
                                        // Clear crop
                                        nextStruct.crop = undefined;
                                    }
                                }
                            } else {
                                // Standard Outputs
                                if ((actDef.actionType === 'GATHER' || actDef.actionType === 'CRAFT') && actDef.outputs) {
                                    actDef.outputs.forEach(out => {
                                        let quantityToAdd = out.quantity;

                                        if (actDef.actionType === 'GATHER') {
                                             const skillLevel = worker.skills[actDef.requiredSkill] || 0;
                                             const multiplier = 0.5 + (skillLevel / 20.0) * 1.5;
                                             quantityToAdd = Math.floor(out.quantity * multiplier);
                                        }

                                        if (quantityToAdd > 0) {
                                            addItemToInventory(worker.inventory, {
                                                id: `item-${Date.now()}-${Math.random()}`,
                                                name: out.itemName,
                                                quantity: quantityToAdd,
                                                weight: 1 
                                            });
                                            logMsg += ` -> ${quantityToAdd}x ${out.itemName}`;
                                        }
                                    });
                                } else if (actDef.actionType === 'STORE') {
                                    if (worker.inventory.length > 0) {
                                        const itemCount = worker.inventory.reduce((acc, i) => acc + i.quantity, 0);
                                        // Move items to chest with stacking
                                        worker.inventory.forEach(item => {
                                            addItemToInventory(nextStruct.inventory, item);
                                        });
                                        worker.inventory = [];
                                        logMsg = `[${worker.name}] stored ${itemCount} items`;
                                    }
                                }
                            }
                            
                            logs.push({ message: logMsg, type: 'success' });

                            // Check Repeats
                            const repeatsLeft = (nextStruct.currentActivity.repeatsLeft || 1) - 1;
                            // Farm planting/harvesting doesn't repeat immediately on same tile usually
                            const isFarm = nextStruct.type === 'FARM_PLOT';
                            
                            if (repeatsLeft > 0 && !isFarm) {
                                // Continue
                                let hasIngredients = true;
                                if (actDef.inputs) {
                                    actDef.inputs.forEach(inp => {
                                        const invItem = worker.inventory.find(i => i.name === inp.itemName);
                                        if (!invItem || invItem.quantity < inp.quantity) hasIngredients = false;
                                    });
                                }

                                if (hasIngredients) {
                                    nextStruct.currentActivity = {
                                        ...nextStruct.currentActivity,
                                        progress: 0,
                                        repeatsLeft
                                    };
                                } else {
                                    logs.push({ message: `[${worker.name}] stopped: Missing ingredients`, type: 'warning' });
                                    nextStruct.currentActivity = undefined;
                                    finalPawns[workerIdx].currentJob = null;
                                    finalPawns[workerIdx].status = 'Idle';
                                }
                            } else {
                                // Done
                                nextStruct.currentActivity = undefined;
                                finalPawns[workerIdx].currentJob = null;
                                finalPawns[workerIdx].status = 'Idle';

                                // If GATHER and not Farm, destroy structure (it's harvested)
                                if (actDef.actionType === 'GATHER' && nextStruct.type !== 'FARM_PLOT') {
                                    return null; 
                                }
                            }

                        } else {
                            nextStruct.currentActivity = { ...nextStruct.currentActivity, progress: newProgress };
                        }
                    }
                }
            }
        }
        return nextStruct;
    }).filter(s => s !== null) as Structure[];

    return { nextStructures, nextPawns: finalPawns, logs };
};