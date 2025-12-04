

import { Pawn, Job, Structure, LogEntry, PawnEffect, EffectType } from '../types';
import { STRUCTURES, CONSTRUCT_ACTIVITY_ID, NEEDS, FOOD_ITEMS, EFFECT_DURATION_TICKS, STARVATION_DEATH_TICKS } from '../constants';
import { findSourceForItems } from '../utils/inventoryUtils';

type LogEvent = Omit<LogEntry, 'id' | 'timestamp'>;

export const assignJobToPawn = (pawn: Pawn, job: Job, allStructures: Structure[]): Pawn | null => {
    const targetStructure = allStructures.find(s => s.id === job.targetStructureId);
    if (!targetStructure) return null;

    const def = STRUCTURES[targetStructure.type];
    let requiredItems: {itemName: string, quantity: number}[] = [];
    
    if (job.activityId === CONSTRUCT_ACTIVITY_ID) {
        requiredItems = def.cost.map(c => ({ itemName: c.itemName, quantity: c.amount }));
    } else if (job.activityId) {
        const act = def.activities.find(a => a.id === job.activityId);
        if (act && act.inputs) {
           requiredItems = act.inputs.map(i => ({ itemName: i.itemName, quantity: i.quantity * (job.activityRepeats || 1) }));
        }
    }

    let jobChain: Job = job;

    if (requiredItems.length > 0) {
        const sources = findSourceForItems(requiredItems, pawn.inventory, allStructures);
        if (!sources) return null; // Cannot find resources

        let firstJob: Job | null = null;
        let currentLink: Job | null = null;

        sources.forEach(source => {
             const fetchJob: Job = {
                 id: `job-fetch-${Date.now()}-${source.itemName}-${Math.random()}`,
                 type: 'WITHDRAW',
                 targetStructureId: source.sourceId,
                 itemsToHandle: [{ itemName: source.itemName, quantity: source.quantity }]
             };
             
             if (!firstJob) {
                 firstJob = fetchJob;
                 currentLink = fetchJob;
             } else if (currentLink) {
                 currentLink.nextJob = fetchJob;
                 currentLink = fetchJob;
             }
         });

         if (currentLink) {
             // @ts-ignore - TS sometimes struggles with mutable chaining but this is valid
             currentLink.nextJob = job;
             jobChain = firstJob as Job;
         }
    }

    return {
        ...pawn,
        currentJob: jobChain,
        status: 'Starting Assigned Job'
    };
};

// --- Needs Logic Helpers ---

const findFoodSource = (pawn: Pawn, structures: Structure[]): Job | null => {
    // 1. Check Pawn Inventory
    const edibleInInventory = pawn.inventory.find(i => FOOD_ITEMS[i.name] !== undefined);
    if (edibleInInventory) {
        return {
            id: `job-eat-${Date.now()}`,
            type: 'EAT',
            itemsToHandle: [{ itemName: edibleInInventory.name, quantity: 1 }]
        };
    }

    // 2. Check Structures (Chests, Bushes, etc)
    // Priority: Cooked Meals > Raw Food
    let bestSource: { structId: string, itemName: string } | null = null;
    let bestScore = -1;

    structures.forEach(s => {
        // Inventory check
        s.inventory.forEach(item => {
            if (FOOD_ITEMS[item.name]) {
                const score = item.name.includes('Meal') ? 10 : 1;
                if (score > bestScore) {
                    bestScore = score;
                    bestSource = { structId: s.id, itemName: item.name };
                }
            }
        });
        // Berry Bush direct harvest logic could go here, but for now we rely on picked berries
    });

    if (bestSource) {
        return {
            id: `job-fetch-food-${Date.now()}`,
            type: 'WITHDRAW',
            targetStructureId: bestSource.structId,
            itemsToHandle: [{ itemName: bestSource.itemName, quantity: 1 }],
            nextJob: {
                id: `job-eat-${Date.now()}`,
                type: 'EAT',
                itemsToHandle: [{ itemName: bestSource.itemName, quantity: 1 }]
            }
        };
    }

    return null;
};

const findRecreationJob = (pawn: Pawn, structures: Structure[]): Job | null => {
    const nearbyFun = structures.filter(s => {
        const def = STRUCTURES[s.type];
        const recActs = def.activities.filter(a => a.actionType === 'RECREATION');
        if (recActs.length === 0) return false;
        return !s.currentActivity; // Only if free
    });

    if (nearbyFun.length > 0) {
        // Pick random
        const randomStruct = nearbyFun[Math.floor(Math.random() * nearbyFun.length)];
        const def = STRUCTURES[randomStruct.type];
        const recActs = def.activities.filter(a => a.actionType === 'RECREATION');
        const randomAct = recActs[Math.floor(Math.random() * recActs.length)];

        return {
            id: `job-fun-emergency-${Date.now()}`,
            type: 'WORK',
            targetStructureId: randomStruct.id,
            activityId: randomAct.id,
            activityRepeats: 1
        };
    }
    return null;
};

// --- Effects & Stats ---

const getMoveSpeedMultiplier = (pawn: Pawn): number => {
    let multiplier = 1.0;
    pawn.effects.forEach(e => {
        if (e.type === 'WELL_RESTED') multiplier += 0.1;
        if (e.type === 'JOY') multiplier += 0.1;
        if (e.type === 'HUNGRY') multiplier -= 0.1;
        if (e.type === 'TIRED') multiplier -= 0.1;
        if (e.type === 'BORED') multiplier -= 0.1;
    });
    return Math.max(0.1, multiplier); // Min speed 10%
};


export const processPawns = (
    currentPawns: Pawn[], 
    currentStructures: Structure[], 
    currentQueue: Job[]
): { nextPawns: Pawn[], nextQueue: Job[], logs: LogEvent[] } => {
    
    const logs: LogEvent[] = [];
    let nextQueue = [...currentQueue];

    let nextPawns = currentPawns.map(pawn => {
        if (pawn.status === 'Dead') return pawn;

        let updatedPawn = { 
            ...pawn, 
            needs: { ...pawn.needs },
            effects: [...(pawn.effects || [])] // Shallow copy effects
        };

        // --- 1. Effect Processing ---
        // Decay Duration
        updatedPawn.effects = updatedPawn.effects.map(e => {
            if (e.duration !== -1) return { ...e, duration: e.duration - 1 };
            return e;
        }).filter(e => e.duration === -1 || e.duration > 0);

        // Conditional Effects Logic
        const hasEffect = (t: EffectType) => updatedPawn.effects.some(e => e.type === t);
        const addEffect = (e: PawnEffect) => {
            if (!hasEffect(e.type)) updatedPawn.effects.push(e);
        };
        const removeEffect = (t: EffectType) => {
            updatedPawn.effects = updatedPawn.effects.filter(e => e.type !== t);
        };

        // Hungry
        if (updatedPawn.needs.food < NEEDS.CRITICAL.FOOD) {
            addEffect({ type: 'HUNGRY', label: 'Hungry', duration: -1, isPositive: false });
        } else {
            removeEffect('HUNGRY');
        }

        // Tired
        if (updatedPawn.needs.sleep < NEEDS.CRITICAL.SLEEP) {
            addEffect({ type: 'TIRED', label: 'Tired', duration: -1, isPositive: false });
        } else {
            removeEffect('TIRED');
        }

        // Bored
        if (updatedPawn.needs.recreation < NEEDS.CRITICAL.RECREATION) {
            addEffect({ type: 'BORED', label: 'Bored', duration: -1, isPositive: false });
        } else {
            removeEffect('BORED');
        }

        // --- 2. Starvation Death Logic ---
        if (hasEffect('HUNGRY')) {
            updatedPawn.starvationTimer = (updatedPawn.starvationTimer || 0) + 1;
            if (updatedPawn.starvationTimer > STARVATION_DEATH_TICKS) {
                logs.push({ message: `[${pawn.name}] has died of starvation.`, type: 'error' });
                updatedPawn.status = 'Dead';
                updatedPawn.currentJob = null;
                updatedPawn.jobQueue = [];
                updatedPawn.effects = [];
                return updatedPawn; // Stop processing
            }
        } else {
            updatedPawn.starvationTimer = 0;
        }


        // --- 3. Needs Decay ---
        updatedPawn.needs.food = Math.max(0, updatedPawn.needs.food - NEEDS.DECAY.FOOD);
        updatedPawn.needs.sleep = Math.max(0, updatedPawn.needs.sleep - NEEDS.DECAY.SLEEP);
        updatedPawn.needs.recreation = Math.max(0, updatedPawn.needs.recreation - NEEDS.DECAY.RECREATION);

        // --- 4. Critical Interruption Logic ---
        
        // Sleep Critical (< 10)
        if (updatedPawn.needs.sleep < NEEDS.CRITICAL.SLEEP && (updatedPawn.currentJob?.type as string) !== 'SLEEP') {
            logs.push({ message: `[${pawn.name}] collapsed from exhaustion!`, type: 'warning' });
            updatedPawn.jobQueue = [];
            updatedPawn.currentJob = { id: `sleep-emergency-${Date.now()}`, type: 'SLEEP' };
            updatedPawn.status = 'Sleeping (Floor)';
        }
        
        // Food Critical (< 15)
        else if (updatedPawn.needs.food < NEEDS.CRITICAL.FOOD && updatedPawn.currentJob?.type !== 'EAT' && updatedPawn.currentJob?.nextJob?.type !== 'EAT') {
             if ((updatedPawn.currentJob?.type as string) !== 'SLEEP') {
                 const foodJob = findFoodSource(updatedPawn, currentStructures);
                 if (foodJob) {
                     logs.push({ message: `[${pawn.name}] is starving, seeking food.`, type: 'warning' });
                     updatedPawn.jobQueue = []; 
                     updatedPawn.currentJob = foodJob;
                 }
             }
        }

        // Recreation Critical (< 20)
        else if (updatedPawn.needs.recreation < NEEDS.CRITICAL.RECREATION && !updatedPawn.currentJob) {
             const funJob = findRecreationJob(updatedPawn, currentStructures);
             if (funJob) {
                 logs.push({ message: `[${pawn.name}] needs recreation desperately.`, type: 'info' });
                 updatedPawn.currentJob = funJob;
             }
        }

        return updatedPawn;
    });

    // --- Standard Job Processing ---
    
    // 1. Idle Pawns Check Global Queue
    nextPawns = nextPawns.map(pawn => {
        if (pawn.status === 'Dead') return pawn;

        if (!pawn.currentJob && pawn.jobQueue.length === 0 && nextQueue.length > 0 && pawn.needs.sleep > NEEDS.CRITICAL.SLEEP) {
            for (let i = 0; i < nextQueue.length; i++) {
                const jobCandidate = nextQueue[i];
                const updatedPawn = assignJobToPawn(pawn, jobCandidate, currentStructures);
                if (updatedPawn) {
                    nextQueue.splice(i, 1);
                    return updatedPawn;
                }
            }
        }
        return pawn;
    });

    // 2. Idle Boredom Check
    nextPawns = nextPawns.map(pawn => {
        if (pawn.status === 'Dead') return pawn;
        if (!pawn.currentJob && pawn.jobQueue.length === 0 && nextQueue.length === 0 && pawn.status === 'Idle') {
            const recChance = pawn.needs.recreation < 80 ? 0.1 : 0.01;
            if (Math.random() < recChance) {
                const funJob = findRecreationJob(pawn, currentStructures);
                if (funJob) {
                     logs.push({ message: `[${pawn.name}] decided to relax.`, type: 'info' });
                     const updatedPawn = assignJobToPawn(pawn, funJob, currentStructures);
                     if (updatedPawn) return updatedPawn;
                }
            }
        }
        return pawn;
    });

    // 3. Process Pawn Actions
    nextPawns = nextPawns.map(pawn => {
        if (pawn.status === 'Dead') return pawn;

        let nextPawn = { ...pawn };

        // Queue Advancement
        if (!nextPawn.currentJob && nextPawn.jobQueue.length > 0) {
            const nextJob = nextPawn.jobQueue[0];
            return {
                ...nextPawn,
                jobQueue: nextPawn.jobQueue.slice(1),
                currentJob: nextJob,
                status: 'Starting Next Task'
            };
        }

        if (!nextPawn.currentJob) return { ...nextPawn, status: 'Idle' };

        const job = nextPawn.currentJob;

        // --- JOB TYPES ---

        if (job.type === 'SLEEP') {
            nextPawn.status = 'Sleeping';
            nextPawn.needs.sleep = Math.min(100, nextPawn.needs.sleep + NEEDS.REPLENISH.SLEEP);
            if (nextPawn.needs.sleep >= 100) {
                // WELL RESTED BONUS
                nextPawn.effects.push({
                    type: 'WELL_RESTED',
                    label: 'Well Rested',
                    duration: EFFECT_DURATION_TICKS,
                    isPositive: true
                });
                logs.push({ message: `[${nextPawn.name}] woke up fully rested.`, type: 'info' });
                nextPawn.currentJob = null;
                nextPawn.status = 'Idle';
            }
            return nextPawn;
        }

        if (job.type === 'EAT') {
            nextPawn.status = 'Eating';
            const foodName = job.itemsToHandle?.[0]?.itemName;
            if (foodName) {
                const idx = nextPawn.inventory.findIndex(i => i.name === foodName);
                if (idx !== -1) {
                    const nutrition = FOOD_ITEMS[foodName] || 50;
                    
                    // Consume
                    nextPawn.inventory[idx].quantity -= 1;
                    if (nextPawn.inventory[idx].quantity <= 0) nextPawn.inventory.splice(idx, 1);
                    
                    nextPawn.needs.food = Math.min(100, nextPawn.needs.food + nutrition);
                    logs.push({ message: `[${nextPawn.name}] ate ${foodName}.`, type: 'success' });
                    
                    // SATED BONUS (Only cooked meals, only if full)
                    if (nextPawn.needs.food >= 100 && (foodName === 'Simple Meal' || foodName === 'Fine Meal')) {
                         nextPawn.effects.push({
                            type: 'SATED',
                            label: 'Sated',
                            duration: EFFECT_DURATION_TICKS,
                            isPositive: true
                        });
                    }

                    nextPawn.currentJob = null;
                    nextPawn.status = 'Idle';
                } else {
                    logs.push({ message: `[${nextPawn.name}] couldn't find food to eat!`, type: 'error' });
                    nextPawn.currentJob = null;
                }
            }
            return nextPawn;
        }

        // --- MOVEMENT LOGIC with Buffering ---
        const moveOneStep = (destX: number, destY: number): boolean => {
            const speedMult = getMoveSpeedMultiplier(nextPawn);
            // Accumulate movement based on multiplier. Base speed 1.0/tick * multiplier.
            nextPawn.movementBuffer = (nextPawn.movementBuffer || 0) + (1.0 * speedMult);

            // While buffer >= 1, take steps. This allows >1 tile per tick for very fast pawns,
            // or accumulating over multiple ticks for slow pawns.
            let hasMoved = false;
            let arrived = false;
            
            while (nextPawn.movementBuffer >= 1.0) {
                const dx = destX - nextPawn.x;
                const dy = destY - nextPawn.y;
                
                if (dx === 0 && dy === 0) {
                    arrived = true;
                    break;
                }

                if (dx !== 0) nextPawn.x += Math.sign(dx);
                else if (dy !== 0) nextPawn.y += Math.sign(dy);
                
                nextPawn.movementBuffer -= 1.0;
                hasMoved = true;
            }
            
            // Check arrival again in case we arrived exactly
            if (destX === nextPawn.x && destY === nextPawn.y) return true;
            return arrived;
        };

        if (job.type === 'MOVE') {
            if (job.targetX !== undefined && job.targetY !== undefined) {
                const arrived = moveOneStep(job.targetX, job.targetY);
                if (arrived) {
                    if (job.nextJob) {
                        nextPawn.currentJob = job.nextJob;
                    } else {
                        nextPawn.currentJob = null;
                        nextPawn.status = 'Idle';
                    }
                } else {
                    nextPawn.status = 'Moving';
                }
            }
        } else if (job.type === 'WITHDRAW') {
             const targetStructure = currentStructures.find(s => s.id === job.targetStructureId);
             if (!targetStructure) {
                 logs.push({ message: `[${pawn.name}] Job Failed: Target structure missing`, type: 'error' });
                 nextPawn.currentJob = null;
                 nextPawn.status = 'Idle';
                 return nextPawn;
             }
             
             // Check distance (Chebyshev)
             const dist = Math.max(Math.abs(targetStructure.x - nextPawn.x), Math.abs(targetStructure.y - nextPawn.y));

             if (dist > 1) { 
                nextPawn.status = 'Fetching Items';
                moveOneStep(targetStructure.x, targetStructure.y);
             } else {
                 if (job.itemsToHandle) {
                     nextPawn.status = 'Withdrawing';
                 }
             }
        } else if (job.type === 'WORK') {
            const targetStructure = currentStructures.find(s => s.id === job.targetStructureId);
            if (!targetStructure) {
                nextPawn.currentJob = null;
                nextPawn.status = 'Idle';
                return nextPawn;
            }

            const dist = Math.max(Math.abs(targetStructure.x - nextPawn.x), Math.abs(targetStructure.y - nextPawn.y));
            
            if (dist > 1) { 
                nextPawn.status = 'Moving to Work';
                moveOneStep(targetStructure.x, targetStructure.y);
            } else {
                nextPawn.status = 'Working';
            }
        }

        return nextPawn;
    });

    return { nextPawns, nextQueue, logs };
};