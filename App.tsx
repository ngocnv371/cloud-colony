
import React, { useState, useEffect, useRef } from 'react';
import GameMap from './components/GameMap';
import Sidebar from './components/Sidebar';
import { Pawn, Structure, StructureDefinition, Job, SkillType, MAP_SIZE, TICK_RATE_MS, Item } from './types';
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
  
  // Interaction State
  const [selectedPawnId, setSelectedPawnId] = useState<string | null>(null);
  const [selectedStructureId, setSelectedStructureId] = useState<string | null>(null);
  const [buildMode, setBuildMode] = useState<StructureDefinition | null>(null);
  const [hoverPos, setHoverPos] = useState<{x: number, y: number} | null>(null);
  const [isGeneratingPawn, setIsGeneratingPawn] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Refs for Game Loop to access latest state without re-triggering effect
  const stateRef = useRef({ pawns, structures });
  useEffect(() => {
    stateRef.current = { pawns, structures };
  }, [pawns, structures]);

  // --- Game Loop ---
  useEffect(() => {
    const interval = setInterval(() => {
        tick();
    }, TICK_RATE_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tick = () => {
    const { pawns: currentPawns, structures: currentStructures } = stateRef.current;
    
    // Process Pawns
    const nextPawns = currentPawns.map(pawn => {
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
                 nextPawn.currentJob = null;
                 nextPawn.status = 'Idle';
                 return nextPawn;
             }

             const dist = Math.abs(pawn.x - targetStructure.x) + Math.abs(pawn.y - targetStructure.y);
             if (dist > 1) { // Must be adjacent or on top
                const dx = targetStructure.x - pawn.x;
                const dy = targetStructure.y - pawn.y;
                nextPawn.status = 'Fetching Items';
                if (dx !== 0) nextPawn.x += Math.sign(dx);
                else if (dy !== 0) nextPawn.y += Math.sign(dy);
             } else {
                 // At location, take items instantly
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

            // Are we adjacent or on top?
            const dist = Math.abs(pawn.x - targetStructure.x) + Math.abs(pawn.y - targetStructure.y);
            
            if (dist > 2) { // Allow range of 1 for diagonals slightly or adjacent
                // Move towards it
                const dx = targetStructure.x - pawn.x;
                const dy = targetStructure.y - pawn.y;
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
                needed.forEach(need => {
                    // Find item in structure
                    const itemIndex = nextStruct.inventory.findIndex(i => i.name === need.itemName);
                    if (itemIndex !== -1) {
                        const item = nextStruct.inventory[itemIndex];
                        const amountToTake = Math.min(item.quantity, need.quantity);
                        
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
                    }
                });

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

        // 2. Handle Timed Activities (WORK)
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
                        
                        // Reset Worker
                        finalPawns[workerIdx].currentJob = null;
                        finalPawns[workerIdx].status = 'Idle';
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
                                } else if (actId === HARVEST_ACTIVITY_ID) {
                                    // Harvesting finished
                                    if (nextStruct.crop && nextStruct.crop.planted) {
                                        const cropDef = CROPS[nextStruct.crop.type];
                                        const skillLevel = worker.skills[SkillType.PLANTS] || 0;
                                        const multiplier = 0.5 + (skillLevel / 20.0) * 1.5;
                                        const yieldAmount = Math.floor(cropDef.yield * multiplier);

                                        if (yieldAmount > 0) {
                                             worker.inventory.push({
                                                id: `food-${Date.now()}`,
                                                name: cropDef.name, // e.g. "Rice"
                                                quantity: yieldAmount,
                                                weight: 1
                                             });
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
                                            const existingItem = worker.inventory.find(i => i.name === out.itemName);
                                            if (existingItem) {
                                                existingItem.quantity += quantityToAdd;
                                            } else {
                                                worker.inventory.push({
                                                    id: `item-${Date.now()}-${Math.random()}`,
                                                    name: out.itemName,
                                                    quantity: quantityToAdd,
                                                    weight: 1 
                                                });
                                            }
                                        }
                                    });
                                } else if (actDef.actionType === 'STORE') {
                                    if (worker.inventory.length > 0) {
                                        nextStruct.inventory.push(...worker.inventory);
                                        worker.inventory = [];
                                    }
                                }
                            }
                            
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
        // If farm plot, it's instant build (no cost/time for designating area in MVP) or make it very cheap. 
        // Prompt implies "designate", usually free. But "construct on grid" usually implies work.
        // Let's make Farm Plot a blueprint that needs work (0 cost but 10 ticks work).
        // Wait, STRUCTURES[FARM_PLOT] has empty cost. 
        // If cost is empty, maybe we skip blueprint phase? RimWorld zones are instant.
        // But prompt said "build structures". Let's keep it consistent: Place Blueprint -> Construct.
        // For Farm Plot, Construct act is just "preparing soil".
        
        setStructures(prev => [...prev, newStruct]);
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
                return {
                    ...p,
                    currentJob: {
                        id: `job-${Date.now()}`,
                        type: 'MOVE',
                        targetX: x,
                        targetY: y
                    },
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
  const findSourceForItems = (itemsNeeded: {itemName: string, quantity: number}[], pawnInventory: Item[]): { itemName: string, quantity: number, sourceId: string }[] | null => {
      const sources: { itemName: string, quantity: number, sourceId: string }[] = [];
      
      for (const need of itemsNeeded) {
          const inInv = pawnInventory.find(i => i.name === need.itemName)?.quantity || 0;
          let missing = need.quantity - inInv;
          
          if (missing > 0) {
              const source = structures.find(s => 
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

  const handleOrderJob = (pawnId: string, structureId: string, activityId: string, count: number = 1) => {
      const pawn = pawns.find(p => p.id === pawnId);
      const struct = structures.find(s => s.id === structureId);
      if (!pawn || !struct) return;

      const def = STRUCTURES[struct.type];
      
      let requiredItems: {itemName: string, quantity: number}[] = [];
      
      if (activityId === CONSTRUCT_ACTIVITY_ID) {
          requiredItems = def.cost.map(c => ({ itemName: c.itemName, quantity: c.amount }));
      } else {
          const act = def.activities.find(a => a.id === activityId);
          if (act && act.inputs) {
             requiredItems = act.inputs.map(i => ({ itemName: i.itemName, quantity: i.quantity * count }));
          }
      }

      let jobChain: Job | undefined = undefined;
      const primaryJob: Job = {
          id: `job-work-${Date.now()}`,
          type: 'WORK',
          targetStructureId: structureId,
          activityId: activityId,
          activityRepeats: count
      };
      
      if (requiredItems.length > 0) {
          const sources = findSourceForItems(requiredItems, pawn.inventory);
          
          if (sources === null) {
              alert("Not enough resources found in storage or inventory!");
              return;
          }

          if (sources.length > 0) {
              let firstJob: Job | null = null;
              let currentLink: Job | null = null;

              sources.forEach(source => {
                  const fetchJob: Job = {
                      id: `job-fetch-${Date.now()}-${source.itemName}`,
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
                  currentLink.nextJob = primaryJob;
                  jobChain = firstJob as Job;
              }
          } else {
              jobChain = primaryJob;
          }
      } else {
          jobChain = primaryJob;
      }

      setPawns(prev => prev.map(p => {
          if (p.id === pawnId) {
              return {
                  ...p,
                  currentJob: jobChain || null
              };
          }
          return p;
      }));

      setStructures(prev => prev.map(s => {
          if (s.id === structureId) {
              return {
                  ...s,
                  currentActivity: {
                      activityId,
                      progress: 0,
                      workerId: pawnId,
                      repeatsLeft: count
                  }
              };
          }
          return s;
      }));
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
            status: 'Idle'
        };
        setPawns(prev => [...prev, newPawn]);
      } catch (e) {
          console.error("Failed to generate pawn", e);
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
    </div>
  );
};

export default App;
