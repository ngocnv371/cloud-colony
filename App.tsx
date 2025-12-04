import React, { useState, useEffect, useCallback, useRef } from 'react';
import GameMap from './components/GameMap';
import Sidebar from './components/Sidebar';
import { Pawn, Structure, StructureDefinition, Job, SkillType, MAP_SIZE, TICK_RATE_MS, ActivityDefinition } from './types';
import { STRUCTURES, INITIAL_PAWNS } from './constants';
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

  const [structures, setStructures] = useState<Structure[]>([]);
  
  // Interaction State
  const [selectedPawnId, setSelectedPawnId] = useState<string | null>(null);
  const [selectedStructureId, setSelectedStructureId] = useState<string | null>(null);
  const [buildMode, setBuildMode] = useState<StructureDefinition | null>(null);
  const [hoverPos, setHoverPos] = useState<{x: number, y: number} | null>(null);
  const [isGeneratingPawn, setIsGeneratingPawn] = useState(false);

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
                    nextPawn.currentJob = null; // Job done
                    nextPawn.status = 'Idle';
                } else {
                    nextPawn.status = 'Moving';
                    // Move one step
                    if (dx !== 0) nextPawn.x += Math.sign(dx);
                    else if (dy !== 0) nextPawn.y += Math.sign(dy);
                }
            }
        } else if (job.type === 'WORK') {
            // Check if at location
            const targetStructure = currentStructures.find(s => s.id === job.targetStructureId);
            if (!targetStructure) {
                // Structure gone? Cancel job
                nextPawn.currentJob = null;
                nextPawn.status = 'Idle';
                return nextPawn;
            }

            // Are we adjacent or on top? (Simple range check)
            const dist = Math.abs(pawn.x - targetStructure.x) + Math.abs(pawn.y - targetStructure.y);
            // Some structures are large, check bounds simply
            // For MVP, if dist <= 2 considered "at workbench"
            if (dist > 2) {
                // Move towards it first (Auto-subtask logic simulation)
                const dx = targetStructure.x - pawn.x;
                const dy = targetStructure.y - pawn.y;
                nextPawn.status = 'Moving to Work';
                if (dx !== 0) nextPawn.x += Math.sign(dx);
                else if (dy !== 0) nextPawn.y += Math.sign(dy);
            } else {
                // At location, perform work
                nextPawn.status = 'Working';
                // Find activity duration/progress
                // In a real ECS this is complex. Here we just decrement a timer or similar.
                // For MVP: We update the STRUCTURE's activity progress
            }
        }

        return nextPawn;
    });

    // Process Structures (Work Progress)
    const nextStructures = currentStructures.map(struct => {
        if (!struct.currentActivity) return struct;

        // Find worker
        const worker = nextPawns.find(p => p.id === struct.currentActivity?.workerId);
        
        // If worker is present and working
        if (worker && worker.status === 'Working' && worker.currentJob?.targetStructureId === struct.id) {
            const def = STRUCTURES[struct.type];
            const actDef = def.activities.find(a => a.id === struct.currentActivity?.activityId);
            
            if (actDef) {
                const skillFactor = 1 + (worker.skills[actDef.requiredSkill] * 0.1); // 10% faster per level
                const progressGain = (100 / actDef.durationTicks) * skillFactor;
                
                const newProgress = Math.min(100, struct.currentActivity.progress + progressGain);
                
                if (newProgress >= 100) {
                    // Finished!
                    // Add items to worker inventory
                    if (actDef.outputs) {
                        actDef.outputs.forEach(out => {
                            worker.inventory.push({
                                id: `item-${Date.now()}-${Math.random()}`,
                                name: out.itemName,
                                quantity: out.quantity,
                                weight: 1 // simplified
                            });
                        });
                    }
                    
                    // Reset pawn job
                    worker.currentJob = null;
                    worker.status = 'Idle';

                    return { ...struct, currentActivity: undefined };
                }

                return { ...struct, currentActivity: { ...struct.currentActivity, progress: newProgress } };
            }
        }
        return struct;
    });

    // Sync state
    // Note: We modified 'worker' inside the nextPawns map locally, but nextPawns needs to reflect the inventory changes from the structure block?
    // This is the tricky part of not using a robust ECS.
    // Let's patch the inventory update back to pawns.
    // Since we mutate 'worker' object in the structure loop, and 'worker' is a ref to an object in 'nextPawns' array, it *should* work if we are careful about references.
    // Actually, map creates shallow copies. The 'worker' find in nextStructures loop refers to the object inside nextPawns array.
    
    setPawns(nextPawns);
    setStructures(nextStructures);
  };

  // --- Handlers ---

  const handleTileClick = (x: number, y: number) => {
    // 1. Build Mode
    if (buildMode) {
        // Check collision
        const collision = structures.find(s => 
            x >= s.x && x < s.x + STRUCTURES[s.type].width &&
            y >= s.y && y < s.y + STRUCTURES[s.type].height
        );
        
        if (!collision) {
            const newStruct: Structure = {
                id: `struct-${Date.now()}`,
                type: buildMode.type,
                x,
                y
            };
            setStructures([...structures, newStruct]);
            // Stay in build mode for multiple placement
        }
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
        
        // If we have a selected pawn, clicking a structure *might* be a context action in a full game.
        // For this UI, we keep the pawn selected so the sidebar can show "Order Job" buttons on the structure.
        if (!selectedPawnId) {
            // Only clear pawn if we didn't just click one (handled above)
            // Wait, we want to see structure details.
            // Let's allow selecting both: "Pawn X selected, looking at Structure Y"
        } 
        return;
    }

    // 4. Move Command (if pawn selected and clicked empty ground)
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
        // Deselect structure if moving away
        setSelectedStructureId(null);
    } else {
        // Clicked empty void with nothing selected
        setSelectedPawnId(null);
        setSelectedStructureId(null);
    }
  };

  const handleOrderJob = (pawnId: string, structureId: string, activityId: string) => {
      // 1. Assign Job to Pawn
      setPawns(prev => prev.map(p => {
          if (p.id === pawnId) {
              return {
                  ...p,
                  currentJob: {
                      id: `job-work-${Date.now()}`,
                      type: 'WORK',
                      targetStructureId: structureId,
                      activityId: activityId
                  }
              };
          }
          return p;
      }));

      // 2. Initialize Activity on Structure
      setStructures(prev => prev.map(s => {
          if (s.id === structureId) {
              return {
                  ...s,
                  currentActivity: {
                      activityId,
                      progress: 0,
                      workerId: pawnId
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
            skills: newPawnData.skills as any, // Typed correctly in service
            color: `bg-${['red','green','blue','purple','yellow'][Math.floor(Math.random()*5)]}-500`, // Random color class
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

  // Derived state for UI
  const selectedPawn = pawns.find(p => p.id === selectedPawnId);
  const selectedStructure = structures.find(s => s.id === selectedStructureId);

  return (
    <div className="flex h-screen w-screen bg-black overflow-hidden font-sans">
        <GameMap 
            structures={structures}
            pawns={pawns}
            onTileClick={handleTileClick}
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