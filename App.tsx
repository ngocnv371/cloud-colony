
import React, { useState, useEffect, useRef } from 'react';
import GameMap from './components/GameMap';
import Sidebar from './components/Sidebar';
import LogPanel from './components/LogPanel';
import { Pawn, Structure, StructureDefinition, Job, SkillType, MAP_SIZE, TICK_RATE_MS, Item, LogEntry } from './types';
import { STRUCTURES, INITIAL_PAWNS, CONSTRUCT_ACTIVITY_ID, CROPS, HARVEST_ACTIVITY_ID } from './constants';
import { generateRandomPawn } from './services/geminiService';

const App: React.FC = () => {
  // --- State ---
  const [pawns, setPawns] = useState<Pawn[]>(() => 
    INITIAL_PAWNS.map((p, i) => ({
      id: `pawn-${i}`,
      ...p,
      x: 12 + i, // Start near center
      y: 12,
      inventory: [],
      maxWeight: 35,
      currentJob: null,
      jobQueue: [],
      status: 'Idle'
    })) as Pawn[]
  );

  const [structures, setStructures] = useState<Structure[]>(() => {
      // Generate some initial resources
      const initialStructures: Structure[] = [];
      
      // Random Trees
      for(let i=0; i<15; i++) {
          initialStructures.push({
              id: `tree-${i}`,
              type: 'TREE',
              x: Math.floor(Math.random() * MAP_SIZE),
              y: Math.floor(Math.random() * MAP_SIZE),
              inventory: []
          });
      }
      // Random Bushes
      for(let i=0; i<10; i++) {
          initialStructures.push({
              id: `bush-${i}`,
              type: 'BERRY_BUSH',
              x: Math.floor(Math.random() * MAP_SIZE),
              y: Math.floor(Math.random() * MAP_SIZE),
              inventory: []
          });
      }
      return initialStructures;
  });
  
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [globalJobQueue, setGlobalJobQueue] = useState<Job[]>([]);

  // Interaction State
  const [selectedPawnId, setSelectedPawnId] = useState<string | null>(null);
  const [selectedStructureId, setSelectedStructureId] = useState<string | null>(null);
  const [buildMode, setBuildMode] = useState<StructureDefinition | null>(null);
  const [hoverPos, setHoverPos] = useState<{x: number, y: number} | null>(null);
  const [isGeneratingPawn, setIsGeneratingPawn] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Refs for Game Loop to access latest state without re-triggering effect
  const stateRef = useRef({ pawns, structures, logs, globalJobQueue });
  useEffect(() => {
    stateRef.current = { pawns, structures, logs, globalJobQueue };
  }, [pawns, structures, logs, globalJobQueue]);

  const addLog = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
      const newLog: LogEntry = {
          id: `log-${Date.now()}-${Math.random()}`,
          timestamp: Date.now(),
          message,
          type
      };
      setLogs(prev => [...prev.slice(-49), newLog]); // Keep last 50
  };

  // Helper to handle inventory stacking
  const addItemToInventory = (inventory: Item[], newItem: Item) => {
      const existing = inventory.find(i => i.name === newItem.name);
      if (existing) {
          existing.quantity += newItem.quantity;
      } else {
          inventory.push(newItem);
      }
  };

  // Helper to assign a job to a pawn (calculating resources if needed)
  // Returns modified pawn if success, null if failed
  const assignJobToPawn = (pawn: Pawn, job: Job, allStructures: Structure[]): Pawn | null => {
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

  // --- Game Loop ---
  useEffect(() => {
    const interval = setInterval(() => {
        tick();
    }, TICK_RATE_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tick = () => {
    const { pawns: currentPawns, structures: currentStructures, globalJobQueue: currentQueue } = stateRef.current;
    
    let nextPawns = [...currentPawns];
    let nextQueue = [...currentQueue];
    
    // 0. Idle Pawns Check Global Queue
    nextPawns = nextPawns.map(pawn => {
        if (!pawn.currentJob && pawn.jobQueue.length === 0 && nextQueue.length > 0) {
            // Try to find a job from global queue this pawn can do
            for (let i = 0; i < nextQueue.length; i++) {
                const jobCandidate = nextQueue[i];
                const updatedPawn = assignJobToPawn(pawn, jobCandidate, currentStructures);
                
                if (updatedPawn) {
                    // Success taking job
                    nextQueue.splice(i, 1); // Remove from queue
                    // addLog(`[${pawn.name}] picked up ${jobCandidate.activityId} from shared queue`, 'info');
                    return updatedPawn;
                }
            }
        }
        return pawn;
    });

    // Update Queue State if changed
    if (nextQueue.length !== currentQueue.length) {
        setGlobalJobQueue(nextQueue);
    }

    // Process Pawns
    nextPawns = nextPawns.map(pawn => {
        // 1. Check if Idle but has Queue (Personal Queue)
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
                 addLog(`[${pawn.name}] Job Failed: Target structure missing`, 'error');
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

    // Process Structures & Instant Actions (WITHDRAW)
    let finalPawns = [...nextPawns];
    
    const nextStructures = currentStructures.map(struct => {
        let nextStruct = { ...struct };

        // 0. Crop Growth
        if (nextStruct.type === 'FARM_PLOT' && nextStruct.crop && nextStruct.crop.planted && nextStruct.crop.growth < 100) {
            const cropDef = CROPS[nextStruct.crop.type];
            if (cropDef) {
                // Growth rate per tick
                nextStruct.crop.growth = Math.min(100, nextStruct.crop.growth + cropDef.growRate);
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
                            addLog(`[${pawn.name}] picked up ${amountToTake} ${need.itemName}`, 'info');
                            withdrawnAny = true;
                        }
                    }
                });

                if (!withdrawnAny && needed.length > 0) {
                     addLog(`[${pawn.name}] could not find ${needed[0].itemName} in ${STRUCTURES[struct.type].name}`, 'warning');
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

        // 2. CRITICAL FIX: Auto-initialize activity if a pawn is here to work
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
                            addLog(`[${worker.name}] finished constructing ${STRUCTURES[nextStruct.type].name}`, 'success');
                            
                            // Reset Worker
                            finalPawns[workerIdx].currentJob = null;
                            finalPawns[workerIdx].status = 'Idle';
                        } else {
                             addLog(`[${worker.name}] failed construction: Missing Resources`, 'error');
                             finalPawns[workerIdx].currentJob = null;
                             finalPawns[workerIdx].status = 'Idle';
                        }

                    } else {
                         nextStruct.currentActivity.progress = newProgress;
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
                            
                            addLog(logMsg, 'success');

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
                                    addLog(`[${worker.name}] stopped: Missing ingredients`, 'warning');
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
                            nextStruct.currentActivity.progress = newProgress;
                        }
                    }
                }
            }
        }
        return nextStruct;
    }).filter(s => s !== null) as Structure[];

    // Sync state
    setPawns(finalPawns);
    setStructures(nextStructures);
  };

  // --- Handlers ---

  const buildAt = (x: number, y: number) => {
      if (!buildMode) return;
      
      // Check collision
      const collision = structures.find(s => 
        x >= s.x && x < s.x + STRUCTURES[s.type].width &&
        y >= s.y && y < s.y + STRUCTURES[s.type].height
      );
    
      if (!collision) {
        const newStruct: Structure = {
            id: `struct-${Date.now()}-${Math.random()}`,
            type: buildMode.type,
            x,
            y,
            inventory: [],
            isBlueprint: true 
        };
        setStructures(prev => [...prev, newStruct]);
        addLog(`Placed ${buildMode.name} blueprint`);
      }
  };

  const handleTileClick = (x: number, y: number) => {
    // 1. Build Mode
    if (buildMode) {
        buildAt(x, y);
        return;
    }

    // 2. Select Pawn?
    const clickedPawn = pawns.find(p => p.x === x && p.y === y);
    if (clickedPawn) {
        setSelectedPawnId(clickedPawn.id);
        setSelectedStructureId(null);
        return;
    }

    // 3. Select Structure?
    const clickedStructure = structures.find(s => 
        x >= s.x && x < s.x + STRUCTURES[s.type].width &&
        y >= s.y && y < s.y + STRUCTURES[s.type].height
    );

    if (clickedStructure) {
        setSelectedStructureId(clickedStructure.id);
        return;
    }

    // 4. Move Command
    if (selectedPawnId && !clickedStructure && !clickedPawn) {
        setPawns(prev => prev.map(p => {
            if (p.id === selectedPawnId) {
                addLog(`[${p.name}] Moving to (${x},${y})`);
                return {
                    ...p,
                    currentJob: {
                        id: `job-${Date.now()}`,
                        type: 'MOVE',
                        targetX: x,
                        targetY: y
                    },
                    jobQueue: [], // Clear queue on manual move
                    status: 'Moving'
                };
            }
            return p;
        }));
        setSelectedStructureId(null);
    } else {
        setSelectedPawnId(null);
        setSelectedStructureId(null);
    }
  };

  const handleMouseDown = () => {
      if (buildMode) setIsDragging(true);
  };
  
  const handleMouseUp = () => {
      setIsDragging(false);
  };

  const handleTileEnter = (x: number, y: number) => {
      setHoverPos({x, y});
      if (isDragging && buildMode) {
          buildAt(x, y);
      }
  };

  // Helper to find ingredients
  const findSourceForItems = (itemsNeeded: {itemName: string, quantity: number}[], pawnInventory: Item[], allStructures: Structure[]): { itemName: string, quantity: number, sourceId: string }[] | null => {
      const sources: { itemName: string, quantity: number, sourceId: string }[] = [];
      
      for (const need of itemsNeeded) {
          const inInv = pawnInventory.find(i => i.name === need.itemName)?.quantity || 0;
          let missing = need.quantity - inInv;
          
          if (missing > 0) {
              const source = allStructures.find(s => 
                  s.type === 'CHEST' && 
                  s.inventory.some(i => i.name === need.itemName && i.quantity > 0)
              );
              
              if (source) {
                  sources.push({ itemName: need.itemName, quantity: missing, sourceId: source.id });
              } else {
                  return null; 
              }
          }
      }
      return sources;
  };

  // Helper to find connected similar tasks (Flood Fill)
  const findBatchTargets = (startStruct: Structure, activityId: string): Structure[] => {
      const batch: Structure[] = [];
      const queue: Structure[] = [startStruct];
      const visited = new Set<string>();
      visited.add(startStruct.id);

      while(queue.length > 0) {
          const current = queue.shift()!;
          batch.push(current);
          
          // Max batch size to prevent lag/overflow
          if (batch.length > 20) break; 

          // Check 4 neighbors
          const dirs = [[0,1], [0,-1], [1,0], [-1,0]];
          for (const [dx, dy] of dirs) {
              const nx = current.x + dx;
              const ny = current.y + dy;
              
              const neighbor = structures.find(s => s.x === nx && s.y === ny);
              if (neighbor && !visited.has(neighbor.id)) {
                  let isValid = false;
                  
                  // Criteria based on activity
                  if (activityId === CONSTRUCT_ACTIVITY_ID) {
                      // Construct: Must be blueprint of same type
                      if (neighbor.isBlueprint && neighbor.type === startStruct.type) isValid = true;
                  } else if (activityId === HARVEST_ACTIVITY_ID) {
                      // Harvest: Must be Farm Plot with Mature Crop
                      if (neighbor.type === 'FARM_PLOT' && neighbor.crop && neighbor.crop.growth >= 100) isValid = true;
                  } else if (activityId.startsWith('plant_')) {
                      // Plant: Must be Farm Plot with NO crop
                      if (neighbor.type === 'FARM_PLOT' && (!neighbor.crop || !neighbor.crop.planted)) isValid = true;
                  }

                  if (isValid) {
                      visited.add(neighbor.id);
                      queue.push(neighbor);
                  }
              }
          }
      }
      
      // Sort by distance to startStruct for simpler pathing
      return batch.sort((a,b) => {
          const distA = Math.abs(a.x - startStruct.x) + Math.abs(a.y - startStruct.y);
          const distB = Math.abs(b.x - startStruct.x) + Math.abs(b.y - startStruct.y);
          return distA - distB;
      });
  };

  const handleOrderJob = (pawnId: string | null, structureId: string, activityId: string, count: number = 1) => {
      const startStruct = structures.find(s => s.id === structureId);
      if (!startStruct) return;

      // Detect if this is a batch-compatible activity
      const isBatchable = 
        activityId === CONSTRUCT_ACTIVITY_ID || 
        activityId === HARVEST_ACTIVITY_ID || 
        activityId.startsWith('plant_');

      let targets: Structure[] = [startStruct];
      
      if (isBatchable) {
          targets = findBatchTargets(startStruct, activityId);
      }
      
      if (targets.length > 1) {
          addLog(`Queueing batch order: ${activityId} on ${targets.length} targets`);
      } else {
          addLog(`Ordered${pawnId ? ' [Pawn]' : ''}: ${activityId}`);
      }

      // Generate Work Jobs (Goals)
      const workJobs: Job[] = targets.map(target => ({
          id: `job-work-${Date.now()}-${target.id}`,
          type: 'WORK',
          targetStructureId: target.id,
          activityId: activityId,
          activityRepeats: count
      }));

      // Distribution
      let pawnAssigned = false;
      const pawn = pawns.find(p => p.id === pawnId);
      
      if (pawn && workJobs.length > 0) {
          // Try to assign first job to selected pawn
          const successPawn = assignJobToPawn(pawn, workJobs[0], structures);
          if (successPawn) {
              setPawns(prev => prev.map(p => p.id === pawn.id ? successPawn : p));
              pawnAssigned = true;
              
              // Visual Feedback for immediate assignment
              setStructures(prev => prev.map(s => {
                  if (s.id === targets[0].id) {
                      return {
                          ...s,
                          currentActivity: {
                              activityId,
                              progress: 0,
                              workerId: pawn.id,
                              repeatsLeft: count
                          }
                      };
                  }
                  return s;
              }));
          }
      }

      // Remaining Jobs go to Global Queue
      const queueJobs = pawnAssigned ? workJobs.slice(1) : workJobs;
      if (queueJobs.length > 0) {
          setGlobalJobQueue(prev => [...prev, ...queueJobs]);
      }
  };

  const handleGeneratePawn = async () => {
      setIsGeneratingPawn(true);
      try {
        const newPawnData = await generateRandomPawn();
        const newPawn: Pawn = {
            id: `pawn-${Date.now()}`,
            name: newPawnData.name || "Unknown",
            backstory: newPawnData.backstory || "Mystery",
            skills: newPawnData.skills as any, 
            color: `bg-${['red','green','blue','purple','yellow'][Math.floor(Math.random()*5)]}-500`,
            x: Math.floor(Math.random() * MAP_SIZE),
            y: Math.floor(Math.random() * MAP_SIZE),
            inventory: [],
            maxWeight: 35,
            currentJob: null,
            jobQueue: [],
            status: 'Idle'
        };
        setPawns(prev => [...prev, newPawn]);
        addLog(`Recruited ${newPawn.name}: ${newPawn.backstory}`, 'success');
      } catch (e) {
          console.error("Failed to generate pawn", e);
          addLog("Failed to generate pawn", 'error');
      } finally {
          setIsGeneratingPawn(false);
      }
  };

  const selectedPawn = pawns.find(p => p.id === selectedPawnId);
  const selectedStructure = structures.find(s => s.id === selectedStructureId);

  return (
    <div className="flex h-screen w-screen bg-black overflow-hidden font-sans"
         onMouseUp={handleMouseUp} // Global mouse up to catch drags ending outside map
    >
        <GameMap 
            structures={structures}
            pawns={pawns}
            onTileClick={handleTileClick}
            onTileEnter={handleTileEnter}
            onMouseDown={handleMouseDown}
            selectedPawnId={selectedPawnId}
            selectedStructureId={selectedStructureId}
            buildPreview={buildMode}
            hoverPos={hoverPos}
            setHoverPos={setHoverPos}
        />
        <Sidebar 
            selectedPawn={selectedPawn}
            selectedStructure={selectedStructure}
            onOrderJob={handleOrderJob}
            buildMode={buildMode}
            setBuildMode={setBuildMode}
            pawns={pawns}
            isGeneratingPawn={isGeneratingPawn}
            onGeneratePawn={handleGeneratePawn}
        />
        <LogPanel logs={logs} />
    </div>
  );
};

export default App;
