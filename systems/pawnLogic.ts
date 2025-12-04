import { Pawn, Job, Structure, LogEntry } from '../types';
import { STRUCTURES, CONSTRUCT_ACTIVITY_ID } from '../constants';
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

export const processPawns = (
    currentPawns: Pawn[], 
    currentStructures: Structure[], 
    currentQueue: Job[]
): { nextPawns: Pawn[], nextQueue: Job[], logs: LogEvent[] } => {
    
    const logs: LogEvent[] = [];
    let nextQueue = [...currentQueue];

    // 1. Idle Pawns Check Global Queue
    let nextPawns = currentPawns.map(pawn => {
        if (!pawn.currentJob && pawn.jobQueue.length === 0 && nextQueue.length > 0) {
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

    // 2. Process Pawn Actions
    nextPawns = nextPawns.map(pawn => {
        // Check if Idle but has Queue (Personal Queue)
        if (!pawn.currentJob && pawn.jobQueue.length > 0) {
            const nextJob = pawn.jobQueue[0];
            return {
                ...pawn,
                jobQueue: pawn.jobQueue.slice(1),
                currentJob: nextJob,
                status: 'Starting Next Task'
            };
        }

        if (!pawn.currentJob) return { ...pawn, status: 'Idle' };

        const job = pawn.currentJob;
        let nextPawn = { ...pawn };

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

             // Check distance (Chebyshev for adjacency including diagonals)
             const dx = targetStructure.x - pawn.x;
             const dy = targetStructure.y - pawn.y;
             const dist = Math.max(Math.abs(dx), Math.abs(dy));

             if (dist > 1) { 
                nextPawn.status = 'Fetching Items';
                // Move logic
                if (dx !== 0) nextPawn.x += Math.sign(dx);
                else if (dy !== 0) nextPawn.y += Math.sign(dy);
             } else {
                 // At location (adjacent or on top), take items
                 if (job.itemsToHandle) {
                     nextPawn.status = 'Withdrawing';
                 }
             }
        } else if (job.type === 'WORK') {
            // Check if at location
            const targetStructure = currentStructures.find(s => s.id === job.targetStructureId);
            if (!targetStructure) {
                // Structure might have been destroyed or fully processed by someone else
                nextPawn.currentJob = null;
                nextPawn.status = 'Idle';
                return nextPawn;
            }

            // Check distance (Chebyshev for adjacency including diagonals)
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