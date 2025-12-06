
import { Pawn, Job, Structure, LogEntry, PawnEffect, EffectType, TerrainType } from '../types';
import { STRUCTURES, CONSTRUCT_ACTIVITY_ID, NEEDS, FOOD_ITEMS, EFFECT_DURATION_TICKS, STARVATION_DEATH_TICKS, TERRAIN_DEFINITIONS, MAP_SIZE } from '../constants';
import { findSourceForItems } from '../utils/inventoryUtils';
import { findPath, isPassable } from '../utils/mapUtils';

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
             // @ts-ignore
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

    // 2. Check Structures
    let bestSource: { structId: string, itemName: string } | null = null;
    let bestScore = -1;

    structures.forEach(s => {
        s.inventory.forEach(item => {
            if (FOOD_ITEMS[item.name]) {
                const score = item.name.includes('Meal') ? 10 : 1;
                if (score > bestScore) {
                    bestScore = score;
                    bestSource = { structId: s.id, itemName: item.name };
                }
            }
        });
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

const getMoveSpeedMultiplier = (pawn: Pawn, terrain: TerrainType[], structures: Structure[]): number => {
    let multiplier = 1.0;
    
    // Effects
    pawn.effects.forEach(e => {
        if (e.type === 'WELL_RESTED') multiplier += 0.1;
        if (e.type === 'JOY') multiplier += 0.1;
        if (e.type === 'HUNGRY') multiplier -= 0.1;
        if (e.type === 'TIRED') multiplier -= 0.1;
        if (e.type === 'BORED') multiplier -= 0.1;
    });

    // Terrain Penalty/Bonus of CURRENT tile
    if (pawn.x >= 0 && pawn.x < MAP_SIZE && pawn.y >= 0 && pawn.y < MAP_SIZE) {
        const idx = pawn.y * MAP_SIZE + pawn.x;
        const tileType = terrain[idx];
        const terrainDef = TERRAIN_DEFINITIONS[tileType];
        if (terrainDef) {
            multiplier *= terrainDef.speedMult;
        }

        // Floor Bonus (Structure on Layer 1)
        const floor = structures.find(s => s.x === pawn.x && s.y === pawn.y && STRUCTURES[s.type].layer === 1);
        if (floor) {
             const def = STRUCTURES[floor.type];
             if (def.walkSpeedMultiplier) multiplier *= def.walkSpeedMultiplier;
        }
    }

    return Math.max(0.1, multiplier);
};


export const processPawns = (
    currentPawns: Pawn[], 
    currentStructures: Structure[], 
    currentQueue: Job[],
    currentTerrain: TerrainType[]
): { nextPawns: Pawn[], nextQueue: Job[], logs: LogEvent[] } => {
    
    const logs: LogEvent[] = [];
    let nextQueue = [...currentQueue];

    let nextPawns = currentPawns.map(pawn => {
        if (pawn.status === 'Dead') return pawn;

        let updatedPawn = { 
            ...pawn, 
            needs: { ...pawn.needs },
            effects: [...(pawn.effects || [])]
        };

        // --- Effects & Needs Processing (Unchanged logic, just keeping it here) ---
        updatedPawn.effects = updatedPawn.effects.map(e => {
            if (e.duration !== -1) return { ...e, duration: e.duration - 1 };
            return e;
        }).filter(e => e.duration === -1 || e.duration > 0);

        const hasEffect = (t: EffectType) => updatedPawn.effects.some(e => e.type === t);
        const addEffect = (e: PawnEffect) => {
            if (!hasEffect(e.type)) updatedPawn.effects.push(e);
        };
        const removeEffect = (t: EffectType) => {
            updatedPawn.effects = updatedPawn.effects.filter(e => e.type !== t);
        };

        if (updatedPawn.needs.food < NEEDS.CRITICAL.FOOD) addEffect({ type: 'HUNGRY', label: 'Hungry', duration: -1, isPositive: false });
        else removeEffect('HUNGRY');

        if (updatedPawn.needs.sleep < NEEDS.CRITICAL.SLEEP) addEffect({ type: 'TIRED', label: 'Tired', duration: -1, isPositive: false });
        else removeEffect('TIRED');

        if (updatedPawn.needs.recreation < NEEDS.CRITICAL.RECREATION) addEffect({ type: 'BORED', label: 'Bored', duration: -1, isPositive: false });
        else removeEffect('BORED');

        if (hasEffect('HUNGRY')) {
            updatedPawn.starvationTimer = (updatedPawn.starvationTimer || 0) + 1;
            if (updatedPawn.starvationTimer > STARVATION_DEATH_TICKS) {
                logs.push({ message: `[${pawn.name}] has died of starvation.`, type: 'error' });
                updatedPawn.status = 'Dead';
                updatedPawn.currentJob = null;
                updatedPawn.jobQueue = [];
                updatedPawn.effects = [];
                return updatedPawn;
            }
        } else {
            updatedPawn.starvationTimer = 0;
        }

        updatedPawn.needs.food = Math.max(0, updatedPawn.needs.food - NEEDS.DECAY.FOOD);
        updatedPawn.needs.sleep = Math.max(0, updatedPawn.needs.sleep - NEEDS.DECAY.SLEEP);
        updatedPawn.needs.recreation = Math.max(0, updatedPawn.needs.recreation - NEEDS.DECAY.RECREATION);

        if (updatedPawn.needs.sleep < NEEDS.CRITICAL.SLEEP && (updatedPawn.currentJob?.type as string) !== 'SLEEP') {
            logs.push({ message: `[${pawn.name}] collapsed from exhaustion!`, type: 'warning' });
            updatedPawn.jobQueue = [];
            updatedPawn.currentJob = { id: `sleep-emergency-${Date.now()}`, type: 'SLEEP' };
            updatedPawn.status = 'Sleeping (Floor)';
        } else if (updatedPawn.needs.food < NEEDS.CRITICAL.FOOD && updatedPawn.currentJob?.type !== 'EAT' && updatedPawn.currentJob?.nextJob?.type !== 'EAT') {
             if ((updatedPawn.currentJob?.type as string) !== 'SLEEP') {
                 const foodJob = findFoodSource(updatedPawn, currentStructures);
                 if (foodJob) {
                     logs.push({ message: `[${pawn.name}] is starving, seeking food.`, type: 'warning' });
                     updatedPawn.jobQueue = []; 
                     updatedPawn.currentJob = foodJob;
                 }
             }
        } else if (updatedPawn.needs.recreation < NEEDS.CRITICAL.RECREATION && !updatedPawn.currentJob) {
             const funJob = findRecreationJob(updatedPawn, currentStructures);
             if (funJob) updatedPawn.currentJob = funJob;
        }

        return updatedPawn;
    });

    // 1. Assign Jobs to Idle Pawns
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

    // 2. Boredom Check
    nextPawns = nextPawns.map(pawn => {
        if (pawn.status === 'Dead') return pawn;
        if (!pawn.currentJob && pawn.jobQueue.length === 0 && nextQueue.length === 0 && pawn.status === 'Idle') {
            const recChance = pawn.needs.recreation < 80 ? 0.1 : 0.01;
            if (Math.random() < recChance) {
                const funJob = findRecreationJob(pawn, currentStructures);
                if (funJob) {
                     const updatedPawn = assignJobToPawn(pawn, funJob, currentStructures);
                     if (updatedPawn) return updatedPawn;
                }
            }
        }
        return pawn;
    });

    // 3. Process Actions
    nextPawns = nextPawns.map(pawn => {
        if (pawn.status === 'Dead') return pawn;

        let nextPawn = { ...pawn };

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

        if (job.type === 'SLEEP') {
            nextPawn.status = 'Sleeping';
            nextPawn.needs.sleep = Math.min(100, nextPawn.needs.sleep + NEEDS.REPLENISH.SLEEP);
            if (nextPawn.needs.sleep >= 100) {
                nextPawn.effects.push({ type: 'WELL_RESTED', label: 'Well Rested', duration: EFFECT_DURATION_TICKS, isPositive: true });
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
                    nextPawn.inventory[idx].quantity -= 1;
                    if (nextPawn.inventory[idx].quantity <= 0) nextPawn.inventory.splice(idx, 1);
                    nextPawn.needs.food = Math.min(100, nextPawn.needs.food + nutrition);
                    logs.push({ message: `[${nextPawn.name}] ate ${foodName}.`, type: 'success' });
                    
                    if (nextPawn.needs.food >= 100 && (foodName === 'Simple Meal' || foodName === 'Fine Meal')) {
                         nextPawn.effects.push({ type: 'SATED', label: 'Sated', duration: EFFECT_DURATION_TICKS, isPositive: true });
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

        // --- MOVEMENT LOGIC (Pathfinding) ---
        const moveOneStep = (destX: number, destY: number): boolean => {
            const speedMult = getMoveSpeedMultiplier(nextPawn, currentTerrain, currentStructures);
            nextPawn.movementBuffer = (nextPawn.movementBuffer || 0) + (1.0 * speedMult);

            let hasMoved = false;
            let arrived = false;

            // Only move if buffer is full enough
            while (nextPawn.movementBuffer >= 1.0) {
                // If we are already there
                if (nextPawn.x === destX && nextPawn.y === destY) {
                    arrived = true;
                    break;
                }
                
                // PATHFINDING
                // Find path from Current -> Dest
                let path = findPath(
                    { x: nextPawn.x, y: nextPawn.y }, 
                    { x: destX, y: destY }, 
                    currentStructures, 
                    currentTerrain
                );

                // Fallback: If pathfinding fails but we need to move, try straight line since passability is permissive for now
                if (!path && (Math.abs(nextPawn.x - destX) + Math.abs(nextPawn.y - destY) > 0)) {
                    const dx = Math.sign(destX - nextPawn.x);
                    const dy = Math.sign(destY - nextPawn.y);
                    // Try X then Y
                    if (dx !== 0 && isPassable(nextPawn.x + dx, nextPawn.y, currentStructures, currentTerrain)) {
                        path = [{x: nextPawn.x, y: nextPawn.y}, {x: nextPawn.x + dx, y: nextPawn.y}];
                    } else if (dy !== 0 && isPassable(nextPawn.x, nextPawn.y + dy, currentStructures, currentTerrain)) {
                         path = [{x: nextPawn.x, y: nextPawn.y}, {x: nextPawn.x, y: nextPawn.y + dy}];
                    }
                }

                if (path && path.length > 1) { // Path MUST contain at least [start, nextStep]
                    const nextStep = path[1]; // Get the next step, not the current one
                    nextPawn.x = nextStep.x;
                    nextPawn.y = nextStep.y;
                    hasMoved = true;
                    nextPawn.movementBuffer -= 1.0;
                } else {
                    // Blocked entirely
                    nextPawn.movementBuffer = 0; 
                    break; 
                }
            }
            
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
                 nextPawn.currentJob = null;
                 return nextPawn;
             }
             
             const dist = Math.max(Math.abs(targetStructure.x - nextPawn.x), Math.abs(targetStructure.y - nextPawn.y));
             if (dist > 1) { 
                nextPawn.status = 'Fetching Items';
                moveOneStep(targetStructure.x, targetStructure.y);
             } else {
                 if (job.itemsToHandle) nextPawn.status = 'Withdrawing';
             }
        } else if (job.type === 'WORK') {
            const targetStructure = currentStructures.find(s => s.id === job.targetStructureId);
            if (!targetStructure) {
                nextPawn.currentJob = null;
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
