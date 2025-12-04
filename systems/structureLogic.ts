import { Pawn, Structure, LogEntry, SkillType } from '../types';
import { STRUCTURES, CONSTRUCT_ACTIVITY_ID, HARVEST_ACTIVITY_ID, CROPS, NATURAL_GROWTH_RATE, getLevelRequirement } from '../constants';
import { addItemToInventory } from '../utils/inventoryUtils';

type LogEvent = Omit<LogEntry, 'id' | 'timestamp'>;

// --- Helper Functions ---

const updateGrowth = (structure: Structure): Structure => {
    // 1. Farm Crops
    if (structure.type === 'FARM_PLOT' && structure.crop && structure.crop.planted && structure.crop.growth < 100) {
        const cropDef = CROPS[structure.crop.type];
        if (cropDef) {
            return {
                ...structure,
                crop: {
                    ...structure.crop,
                    growth: Math.min(100, structure.crop.growth + cropDef.growRate)
                }
            };
        }
    }
    
    // 2. Natural Growth (Trees/Bushes)
    if ((structure.type === 'TREE' || structure.type === 'BERRY_BUSH') && structure.growth !== undefined && structure.growth < 100) {
        return {
            ...structure,
            growth: Math.min(100, structure.growth + NATURAL_GROWTH_RATE)
        };
    }
    
    return structure;
};

const handleWithdrawInteractions = (structure: Structure, pawns: Pawn[], logs: LogEvent[]) => {
    pawns.forEach((pawn, pIdx) => {
        if (pawn.currentJob?.type === 'WITHDRAW' && pawn.status === 'Withdrawing' && pawn.currentJob.targetStructureId === structure.id) {
            // Clone pawn for modification
            const updatedPawn = { ...pawn, inventory: pawn.inventory.map(i => ({...i})) };
            const needed = updatedPawn.currentJob!.itemsToHandle || [];
            let withdrawnAny = false;

            needed.forEach(need => {
                const itemIndex = structure.inventory.findIndex(i => i.name === need.itemName);
                if (itemIndex !== -1) {
                    const item = structure.inventory[itemIndex];
                    const amountToTake = Math.min(item.quantity, need.quantity);
                    
                    if (amountToTake > 0) {
                        const pawnItemIndex = updatedPawn.inventory.findIndex(pi => pi.name === need.itemName);
                        if (pawnItemIndex !== -1) {
                            updatedPawn.inventory[pawnItemIndex].quantity += amountToTake;
                        } else {
                            updatedPawn.inventory.push({ ...item, quantity: amountToTake });
                        }

                        // Structure inventory is mutated in place as it's being mapped over in the main loop anyway
                        // but strictly we should treat it carefully. For now, direct mutation of the structure passed in is handled by the caller creating a copy.
                        item.quantity -= amountToTake;
                        if (item.quantity <= 0) {
                            structure.inventory.splice(itemIndex, 1);
                        }
                        logs.push({ message: `[${updatedPawn.name}] picked up ${amountToTake} ${need.itemName}`, type: 'info' });
                        withdrawnAny = true;
                    }
                }
            });

            if (!withdrawnAny && needed.length > 0) {
                 logs.push({ message: `[${updatedPawn.name}] could not find ${needed[0].itemName} in ${STRUCTURES[structure.type].name}`, type: 'warning' });
            }

            // Advance Job
            if (updatedPawn.currentJob?.nextJob) {
                updatedPawn.currentJob = updatedPawn.currentJob.nextJob;
                updatedPawn.status = 'Moving';
            } else {
                updatedPawn.currentJob = null;
                updatedPawn.status = 'Idle';
            }
            
            // Update array
            pawns[pIdx] = updatedPawn;
        }
    });
};

const initializeWorkerActivity = (structure: Structure, pawns: Pawn[]) => {
    if (!structure.currentActivity) {
         const arrivingWorker = pawns.find(p => 
            p.currentJob?.type === 'WORK' && 
            p.currentJob.targetStructureId === structure.id &&
            (p.status === 'Working' || p.status === 'Moving to Work')
         );

         if (arrivingWorker) {
             const dx = arrivingWorker.x - structure.x;
             const dy = arrivingWorker.y - structure.y;
             const dist = Math.max(Math.abs(dx), Math.abs(dy));

             if (dist <= 1) { 
                 structure.currentActivity = {
                     activityId: arrivingWorker.currentJob!.activityId!,
                     progress: 0,
                     workerId: arrivingWorker.id,
                     repeatsLeft: arrivingWorker.currentJob!.activityRepeats || 1
                 };
             }
         }
    }
};

const completeConstruction = (structure: Structure, pawns: Pawn[], workerIdx: number, logs: LogEvent[]): Structure => {
    const worker = { ...pawns[workerIdx], inventory: pawns[workerIdx].inventory.map(i => ({...i})) };
    const cost = STRUCTURES[structure.type].cost;
    
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

        logs.push({ message: `[${worker.name}] finished constructing ${STRUCTURES[structure.type].name}`, type: 'success' });
        
        worker.currentJob = null;
        worker.status = 'Idle';
        
        pawns[workerIdx] = worker;

        return {
            ...structure,
            isBlueprint: false,
            currentActivity: undefined
        };
    } else {
        logs.push({ message: `[${worker.name}] failed construction: Missing Resources`, type: 'error' });
        worker.currentJob = null;
        worker.status = 'Idle';
        pawns[workerIdx] = worker;
        
        return {
            ...structure,
            currentActivity: undefined
        };
    }
};

const completeActivity = (structure: Structure, pawns: Pawn[], workerIdx: number, logs: LogEvent[]): Structure | null => {
    const worker = { ...pawns[workerIdx], inventory: pawns[workerIdx].inventory.map(i => ({...i})) };
    const actId = structure.currentActivity!.activityId;
    const def = STRUCTURES[structure.type];
    const actDef = def.activities.find(a => a.id === actId);
    
    if (!actDef) return structure;

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

    let logMsg = `[${worker.name}] finished ${actDef.name}`;
    let nextStruct = { ...structure };

    // Logic per Activity Type
    if (nextStruct.type === 'FARM_PLOT') {
        if (actId.startsWith('plant_')) {
            const cropType = actId.split('_')[1].toUpperCase();
            nextStruct.crop = {
                type: cropType as any,
                growth: 0,
                planted: true
            };
            logMsg = `[${worker.name}] planted ${cropType}`;
        } else if (actId === HARVEST_ACTIVITY_ID) {
            if (nextStruct.crop && nextStruct.crop.planted) {
                const cropDef = CROPS[nextStruct.crop.type];
                const skillLevel = worker.skills[SkillType.PLANTS] || 0;
                const multiplier = 0.5 + (skillLevel / 20.0) * 1.5;
                const yieldAmount = Math.floor(cropDef.yield * multiplier);

                if (yieldAmount > 0) {
                     addItemToInventory(worker.inventory, {
                        id: `food-${Date.now()}`,
                        name: cropDef.name,
                        quantity: yieldAmount,
                        weight: 1
                     });
                     logMsg = `[${worker.name}] harvested ${yieldAmount}x ${cropDef.name}`;
                }
                nextStruct.crop = undefined;
            }
        }
    } else if (actDef.actionType === 'RECREATION') {
        // Recreation just logs and finishes
        logMsg = `[${worker.name}] finished ${actDef.name} (Recreation)`;
    } else {
        if ((actDef.actionType === 'GATHER' || actDef.actionType === 'CRAFT') && actDef.outputs) {
            actDef.outputs.forEach(out => {
                let quantityToAdd = out.quantity;
                if (actDef.actionType === 'GATHER') {
                     const skillLevel = worker.skills[actDef.requiredSkill] || 0;
                     let multiplier = 0.5 + (skillLevel / 20.0) * 1.5;
                     
                     // Apply Growth Modifier for natural structures
                     if (nextStruct.growth !== undefined) {
                         multiplier *= (nextStruct.growth / 100);
                     }
                     
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
                worker.inventory.forEach(item => {
                    addItemToInventory(nextStruct.inventory, item);
                });
                worker.inventory = [];
                logMsg = `[${worker.name}] stored ${itemCount} items`;
            }
        }
    }
    
    logs.push({ message: logMsg, type: 'success' });

    // Handle Repeats
    const repeatsLeft = (nextStruct.currentActivity!.repeatsLeft || 1) - 1;
    const isFarm = nextStruct.type === 'FARM_PLOT';
    
    if (repeatsLeft > 0 && !isFarm) {
        let hasIngredients = true;
        if (actDef.inputs) {
            actDef.inputs.forEach(inp => {
                const invItem = worker.inventory.find(i => i.name === inp.itemName);
                if (!invItem || invItem.quantity < inp.quantity) hasIngredients = false;
            });
        }

        if (hasIngredients) {
            nextStruct.currentActivity = {
                ...nextStruct.currentActivity!,
                progress: 0,
                repeatsLeft
            };
            // Worker stays working
        } else {
            logs.push({ message: `[${worker.name}] stopped: Missing ingredients`, type: 'warning' });
            nextStruct.currentActivity = undefined;
            worker.currentJob = null;
            worker.status = 'Idle';
        }
    } else {
        nextStruct.currentActivity = undefined;
        worker.currentJob = null;
        worker.status = 'Idle';

        // GATHER typically destroys the source (Mining/Chopping), unless it's a farm.
        // RECREATION does not destroy the source.
        if (actDef.actionType === 'GATHER' && nextStruct.type !== 'FARM_PLOT') {
            pawns[workerIdx] = worker;
            return null; // Destroy source
        }
    }
    
    pawns[workerIdx] = worker;
    return nextStruct;
};

const updateActivityProgress = (structure: Structure, pawns: Pawn[], logs: LogEvent[]): Structure | null => {
    if (!structure.currentActivity) return structure;

    const workerIdx = pawns.findIndex(p => p.id === structure.currentActivity?.workerId);
    if (workerIdx === -1) return structure; // Worker gone
    
    const worker = pawns[workerIdx];
    
    // Validate worker is actually working on this
    if (worker.status !== 'Working' || worker.currentJob?.targetStructureId !== structure.id) {
        return structure;
    }

    const actId = structure.currentActivity.activityId;
    let newProgress = structure.currentActivity.progress;
    
    // Determine active skill
    let activeSkill = SkillType.CONSTRUCTION;
    let actDef;
    if (actId === CONSTRUCT_ACTIVITY_ID) {
        activeSkill = SkillType.CONSTRUCTION;
    } else {
        const def = STRUCTURES[structure.type];
        actDef = def.activities.find(a => a.id === actId);
        if (actDef) activeSkill = actDef.requiredSkill;
    }
    
    // Award XP
    const updatedWorker = { ...worker, skillXp: { ...worker.skillXp }, skills: { ...worker.skills } };
    const xpGain = 1; // 1 XP per tick
    
    // Safe initialization just in case old pawn data exists
    if (updatedWorker.skillXp[activeSkill] === undefined) updatedWorker.skillXp[activeSkill] = 0;
    
    updatedWorker.skillXp[activeSkill] += xpGain;
    
    const req = getLevelRequirement(updatedWorker.skills[activeSkill]);
    if (updatedWorker.skillXp[activeSkill] >= req) {
        updatedWorker.skills[activeSkill]++;
        updatedWorker.skillXp[activeSkill] -= req; // Carry over overflow
        logs.push({ 
            message: `[${worker.name}] leveled up ${activeSkill} to ${updatedWorker.skills[activeSkill]}!`, 
            type: 'success' 
        });
    }
    pawns[workerIdx] = updatedWorker;

    if (actId === CONSTRUCT_ACTIVITY_ID) {
        const speed = 20;
        const skillFactor = 1 + (updatedWorker.skills[SkillType.CONSTRUCTION] * 0.1);
        const progressGain = (100 / speed) * skillFactor;
        newProgress = Math.min(100, newProgress + progressGain);
        
        if (newProgress >= 100) {
            return completeConstruction(structure, pawns, workerIdx, logs);
        }
    } else {
        if (actDef) {
            const skillFactor = 1 + (updatedWorker.skills[actDef.requiredSkill] * 0.1); 
            const progressGain = (100 / actDef.durationTicks) * skillFactor;
            newProgress = Math.min(100, newProgress + progressGain);

            if (newProgress >= 100) {
                return completeActivity(structure, pawns, workerIdx, logs);
            }
        }
    }

    return {
        ...structure,
        currentActivity: {
            ...structure.currentActivity,
            progress: newProgress
        }
    };
};

// --- Main System ---

export const processStructures = (
    currentStructures: Structure[],
    currentPawns: Pawn[]
): { nextStructures: Structure[], nextPawns: Pawn[], logs: LogEvent[] } => {
    
    const logs: LogEvent[] = [];
    const finalPawns = [...currentPawns]; // Shallow copy of array, items are refs
    
    const nextStructures = currentStructures.map(struct => {
        let nextStruct = updateGrowth(struct);
        
        handleWithdrawInteractions(nextStruct, finalPawns, logs);
        
        initializeWorkerActivity(nextStruct, finalPawns);
        
        return updateActivityProgress(nextStruct, finalPawns, logs);
    }).filter(s => s !== null) as Structure[];

    return { nextStructures, nextPawns: finalPawns, logs };
};