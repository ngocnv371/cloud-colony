import { Pawn, Job, Structure, LogEntry, Item } from '../types';
import { STRUCTURES, CONSTRUCT_ACTIVITY_ID, NEEDS, FOOD_ITEMS } from '../constants';
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


export const processPawns = (
    currentPawns: Pawn[], 
    currentStructures: Structure[], 
    currentQueue: Job[]
): { nextPawns: Pawn[], nextQueue: Job[], logs: LogEvent[] } => {
    
    const logs: LogEvent[] = [];
    let nextQueue = [...currentQueue];

    let nextPawns = currentPawns.map(pawn => {
        let updatedPawn = { ...pawn, needs: { ...pawn.needs } };

        // --- Needs Decay ---
        updatedPawn.needs.food = Math.max(0, updatedPawn.needs.food - NEEDS.DECAY.FOOD);
        updatedPawn.needs.sleep = Math.max(0, updatedPawn.needs.sleep - NEEDS.DECAY.SLEEP);
        updatedPawn.needs.recreation = Math.max(0, updatedPawn.needs.recreation - NEEDS.DECAY.RECREATION);

        // --- Critical Interruption Logic ---
        // Only interrupt if not already fixing the problem
        
        // 1. Sleep Critical (< 10)
        // Explicit cast to string to avoid TS error: comparison appears to be unintentional because the types ... and 'SLEEP' have no overlap
        if (updatedPawn.needs.sleep < NEEDS.CRITICAL.SLEEP && (updatedPawn.currentJob?.type as string) !== 'SLEEP') {
            logs.push({ message: `[${pawn.name}] collapsed from exhaustion!`, type: 'warning' });
            // Drop everything
            if (updatedPawn.currentJob && (updatedPawn.currentJob.type as string) !== 'SLEEP') {
                 // If holding items for a job, technically should drop them, but we keep inventory simple
                 // Logic: Clear queue, set immediate sleep
            }
            updatedPawn.jobQueue = [];
            updatedPawn.currentJob = { id: `sleep-emergency-${Date.now()}`, type: 'SLEEP' };
            updatedPawn.status = 'Sleeping (Floor)';
        }
        
        // 2. Food Critical (< 15)
        else if (updatedPawn.needs.food < NEEDS.CRITICAL.FOOD && updatedPawn.currentJob?.type !== 'EAT' && updatedPawn.currentJob?.nextJob?.type !== 'EAT') {
             // Only search if not already sleeping
             if ((updatedPawn.currentJob?.type as string) !== 'SLEEP') {
                 const foodJob = findFoodSource(updatedPawn, currentStructures);
                 if (foodJob) {
                     logs.push({ message: `[${pawn.name}] is starving, seeking food.`, type: 'warning' });
                     updatedPawn.jobQueue = []; // Clear other tasks
                     updatedPawn.currentJob = foodJob;
                 } else {
                     // Could not find food, will complain in log later or next tick
                 }
             }
        }

        // 3. Recreation Critical (< 20)
        else if (updatedPawn.needs.recreation < NEEDS.CRITICAL.RECREATION && !updatedPawn.currentJob) {
             // Look for fun if idle or just moving
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
        if (!pawn.currentJob && pawn.jobQueue.length === 0 && nextQueue.length > 0 && pawn.needs.sleep > NEEDS.CRITICAL.SLEEP) {
            // Try to find a job from global queue this pawn can do
            for (let i = 0; i < nextQueue.length; i++) {
                const jobCandidate = nextQueue[i];
                const updatedPawn = assignJobToPawn(pawn, jobCandidate, currentStructures);
                
                if (updatedPawn) {
                    // Success taking job
                    nextQueue.splice(i, 1); // Remove from queue
                    return updatedPawn;
                }
            }
        }
        return pawn;
    });

    // 2. Idle Boredom Check (Find Recreation - Non critical)
    nextPawns = nextPawns.map(pawn => {
        if (!pawn.currentJob && pawn.jobQueue.length === 0 && nextQueue.length === 0 && pawn.status === 'Idle') {
            // If needs are decent but recreation isn't full, higher chance to play
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

        // --- NEW JOB TYPES ---

        if (job.type === 'SLEEP') {
            nextPawn.status = 'Sleeping';
            nextPawn.needs.sleep = Math.min(100, nextPawn.needs.sleep + NEEDS.REPLENISH.SLEEP);
            if (nextPawn.needs.sleep >= 100) {
                logs.push({ message: `[${nextPawn.name}] woke up fully rested.`, type: 'info' });
                nextPawn.currentJob = null;
                nextPawn.status = 'Idle';
            }
            return nextPawn; // Don't move
        }

        if (job.type === 'EAT') {
            nextPawn.status = 'Eating';
            // Need item in inventory
            const foodName = job.itemsToHandle?.[0]?.itemName;
            if (foodName) {
                const idx = nextPawn.inventory.findIndex(i => i.name === foodName);
                if (idx !== -1) {
                    // Consume
                    nextPawn.inventory[idx].quantity -= 1;
                    if (nextPawn.inventory[idx].quantity <= 0) nextPawn.inventory.splice(idx, 1);
                    
                    nextPawn.needs.food = Math.min(100, nextPawn.needs.food + NEEDS.REPLENISH.EAT);
                    logs.push({ message: `[${nextPawn.name}] ate ${foodName}.`, type: 'success' });
                    
                    nextPawn.currentJob = null;
                    nextPawn.status = 'Idle';
                } else {
                    // Food missing?
                    logs.push({ message: `[${nextPawn.name}] couldn't find food to eat!`, type: 'error' });
                    nextPawn.currentJob = null;
                }
            }
            return nextPawn;
        }

        // --- EXISTING JOB TYPES ---

        if (job.type === 'MOVE') {
            // Simple movement logic: 1 tile per tick towards target
            if (job.targetX !== undefined && job.targetY !== undefined) {
                const dx = job.targetX - pawn.x;
                const dy = job.targetY - pawn.y;
                
                if (dx === 0 && dy === 0) {
                    // Arrived
                    if (job.nextJob) {
                        nextPawn.currentJob = job.nextJob;
                    } else {
                        nextPawn.currentJob = null;
                        nextPawn.status = 'Idle';
                    }
                } else {
                    nextPawn.status = 'Moving';
                    // Move one step
                    if (dx !== 0) nextPawn.x += Math.sign(dx);
                    else if (dy !== 0) nextPawn.y += Math.sign(dy);
                }
            }
        } else if (job.type === 'WITHDRAW') {
             // Move to target first
             const targetStructure = currentStructures.find(s => s.id === job.targetStructureId);
             if (!targetStructure) {
                 logs.push({ message: `[${pawn.name}] Job Failed: Target structure missing`, type: 'error' });
                 nextPawn.currentJob = null;
                 nextPawn.status = 'Idle';
                 return nextPawn;
             }

             const dx = targetStructure.x - pawn.x;
             const dy = targetStructure.y - pawn.y;
             const dist = Math.max(Math.abs(dx), Math.abs(dy));

             if (dist > 1) { 
                nextPawn.status = 'Fetching Items';
                if (dx !== 0) nextPawn.x += Math.sign(dx);
                else if (dy !== 0) nextPawn.y += Math.sign(dy);
             } else {
                 // At location
                 if (job.itemsToHandle) {
                     nextPawn.status = 'Withdrawing';
                 }
             }
        } else if (job.type === 'WORK') {
            // Check if at location
            const targetStructure = currentStructures.find(s => s.id === job.targetStructureId);
            if (!targetStructure) {
                nextPawn.currentJob = null;
                nextPawn.status = 'Idle';
                return nextPawn;
            }

            const dx = targetStructure.x - pawn.x;
            const dy = targetStructure.y - pawn.y;
            const dist = Math.max(Math.abs(dx), Math.abs(dy));
            
            if (dist > 1) { 
                // Move towards it
                nextPawn.status = 'Moving to Work';
                if (dx !== 0) nextPawn.x += Math.sign(dx);
                else if (dy !== 0) nextPawn.y += Math.sign(dy);
            } else {
                nextPawn.status = 'Working';
                // Progress is handled in Structure Processing
            }
        }

        return nextPawn;
    });

    return { nextPawns, nextQueue, logs };
};
