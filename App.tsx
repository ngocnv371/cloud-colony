

import React, { useState, useEffect, useRef, useMemo } from 'react';
import GameMap from './components/GameMap';
import Sidebar from './components/Sidebar';
import LogPanel from './components/LogPanel';
import ResourceHUD from './components/ResourceHUD';
import { Pawn, Structure, StructureDefinition, Job, MAP_SIZE, TICK_RATE_MS, LogEntry, SkillType } from './types';
import { STRUCTURES, INITIAL_PAWNS, CONSTRUCT_ACTIVITY_ID, HARVEST_ACTIVITY_ID, NATURAL_SPAWN_CHANCE, JOY_DURATION_TICKS } from './constants';
import { generateRandomPawn } from './services/geminiService';

// Logic Modules
import { generateInitialStructures, findBatchTargets } from './utils/mapUtils';
import { assignJobToPawn, processPawns } from './systems/pawnLogic';
import { processStructures } from './systems/structureLogic';

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
      status: 'Idle',
      needs: { food: 100, sleep: 100, recreation: 100 },
      effects: [
          {
              type: 'JOY',
              label: 'Joy',
              duration: JOY_DURATION_TICKS,
              isPositive: true
          }
      ],
      starvationTimer: 0,
      movementBuffer: 0
    })) as Pawn[]
  );

  const [structures, setStructures] = useState<Structure[]>(() => generateInitialStructures());
  
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [globalJobQueue, setGlobalJobQueue] = useState<Job[]>([]);

  // Interaction State
  const [selectedPawnId, setSelectedPawnId] = useState<string | null>(null);
  const [selectedStructureId, setSelectedStructureId] = useState<string | null>(null);
  const [buildMode, setBuildMode] = useState<StructureDefinition | null>(null);
  const [commandMode, setCommandMode] = useState<'HARVEST' | 'CHOP' | 'MINE' | null>(null);
  const [hoverPos, setHoverPos] = useState<{x: number, y: number} | null>(null);
  const [isGeneratingPawn, setIsGeneratingPawn] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{x: number, y: number} | null>(null);

  // Refs for Game Loop to access latest state without re-triggering effect
  const stateRef = useRef({ pawns, structures, logs, globalJobQueue });
  useEffect(() => {
    stateRef.current = { pawns, structures, logs, globalJobQueue };
  }, [pawns, structures, logs, globalJobQueue]);

  // Derived state for visual feedback on map
  const queuedTargets = useMemo(() => {
    const targets = new Map<string, string>();
    // Global Queue
    globalJobQueue.forEach(j => {
        if(j.targetStructureId) targets.set(j.targetStructureId, j.activityId || j.type);
    });
    // Pawns
    pawns.forEach(p => {
        if(p.currentJob?.targetStructureId) targets.set(p.currentJob.targetStructureId, p.currentJob.activityId || p.currentJob.type);
        p.jobQueue.forEach(j => {
             if(j.targetStructureId) targets.set(j.targetStructureId, j.activityId || j.type);
        });
    });
    return targets;
  }, [globalJobQueue, pawns]);

  const addLog = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
      const newLog: LogEntry = {
          id: `log-${Date.now()}-${Math.random()}`,
          timestamp: Date.now(),
          message,
          type
      };
      setLogs(prev => [...prev.slice(-49), newLog]); // Keep last 50
  };

  const addLogs = (newLogs: { message: string, type: 'info' | 'success' | 'warning' | 'error' }[]) => {
      if (newLogs.length === 0) return;
      const entries: LogEntry[] = newLogs.map(l => ({
          id: `log-${Date.now()}-${Math.random()}`,
          timestamp: Date.now(),
          message: l.message,
          type: l.type
      }));
      setLogs(prev => [...prev.slice(-(50 - entries.length)), ...entries]);
  };

  // --- Helpers ---
  const spawnNaturalResources = (currentStructures: Structure[]) => {
      if (Math.random() < NATURAL_SPAWN_CHANCE) {
          const type = Math.random() > 0.6 ? 'TREE' : 'BERRY_BUSH'; // 40% Tree, 60% Bush
          const x = Math.floor(Math.random() * MAP_SIZE);
          const y = Math.floor(Math.random() * MAP_SIZE);

          // Check if occupied
          const occupied = currentStructures.some(s => s.x === x && s.y === y);
          if (!occupied) {
              const newStruct: Structure = {
                  id: `${type.toLowerCase()}-${Date.now()}-${Math.random()}`,
                  type,
                  x,
                  y,
                  inventory: [],
                  growth: 0 // Start as a sapling
              };
              return [...currentStructures, newStruct];
          }
      }
      return currentStructures;
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
    
    // 0. Natural Spawning
    const structuresAfterSpawn = spawnNaturalResources(currentStructures);

    // 1. Process Pawns (Movement, Needs, Idle Job Assignment, Personal Queue)
    const { nextPawns: intermediatePawns, nextQueue: queueAfterPawns, logs: pawnLogs } = processPawns(currentPawns, structuresAfterSpawn, currentQueue);
    
    // 2. Process Structures (Crop/Natural Growth, Activities, Withdraw Interactions)
    // Note: This step also processes pawn work progress and returns the final state of pawns for this tick
    const { nextStructures, nextPawns: finalPawns, logs: structureLogs } = processStructures(structuresAfterSpawn, intermediatePawns);

    // Sync state
    if (JSON.stringify(currentQueue) !== JSON.stringify(queueAfterPawns)) {
        setGlobalJobQueue(queueAfterPawns);
    }
    
    setPawns(finalPawns);
    setStructures(nextStructures);
    addLogs([...pawnLogs, ...structureLogs]);
  };

  // --- Command Helper ---
  const getCommandActivity = (structure: Structure, mode: 'HARVEST' | 'CHOP' | 'MINE'): string | null => {
      const def = STRUCTURES[structure.type];
      if (!def) return null;
      
      if (mode === 'CHOP' && def.type === 'TREE') {
          // Allow chopping any tree
          return 'chop_wood';
      }
      
      if (mode === 'HARVEST') {
          if (def.type === 'BERRY_BUSH') {
              // Allow harvest if >= 80%
              if (structure.growth !== undefined && structure.growth < 80) return null;
              return 'harvest_berry';
          }
          if (def.type === 'FARM_PLOT' && structure.crop && structure.crop.growth >= 100) return HARVEST_ACTIVITY_ID;
      }
      
      if (mode === 'MINE') {
          const mineAct = def.activities.find(a => a.requiredSkill === SkillType.MINING && a.actionType === 'GATHER');
          if (mineAct) return mineAct.id;
      }

      return null;
  };

  // --- Handlers ---

  const buildAt = (x: number, y: number) => {
      if (!buildMode) return;
      
      setStructures(prev => {
          // Collision check using latest state
          const collision = prev.find(s => 
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
             
             // Auto-Queue Job
             const newJob: Job = {
                 id: `job-construct-${newStruct.id}`,
                 type: 'WORK',
                 targetStructureId: newStruct.id,
                 activityId: CONSTRUCT_ACTIVITY_ID,
                 activityRepeats: 1
             };
             
             setGlobalJobQueue(queue => [...queue, newJob]);
             addLog(`Placed & queued ${buildMode.name}`);
             
             return [...prev, newStruct];
          }
          return prev;
      });
  };

  const batchCommand = (x1: number, y1: number, x2: number, y2: number) => {
      if (!commandMode) return;
      
      let jobsCreated = 0;
      const newJobs: Job[] = [];

      structures.forEach(s => {
          // Check if structure is within bounds
          const isInBounds = s.x >= x1 && s.x <= x2 && s.y >= y1 && s.y <= y2;
          if (!isInBounds) return;

          // Check if compatible with command
          const activityId = getCommandActivity(s, commandMode);
          if (activityId) {
             // Avoid duplicates in queue (simple check)
             const alreadyQueued = globalJobQueue.some(j => j.targetStructureId === s.id && j.activityId === activityId);
             const alreadyActive = s.currentActivity?.activityId === activityId;
             
             if (!alreadyQueued && !alreadyActive) {
                 newJobs.push({
                     id: `job-cmd-${Date.now()}-${s.id}`,
                     type: 'WORK',
                     targetStructureId: s.id,
                     activityId: activityId,
                     activityRepeats: 1
                 });
                 jobsCreated++;
             }
          }
      });

      if (jobsCreated > 0) {
          setGlobalJobQueue(prev => [...prev, ...newJobs]);
          addLog(`Queued ${jobsCreated} ${commandMode.toLowerCase()} orders`, 'success');
      } else {
          addLog(`No valid targets found for ${commandMode.toLowerCase()}`, 'warning');
      }
  };

  const handleTileClick = (x: number, y: number) => {
    // 1. Build Mode
    if (buildMode) {
        buildAt(x, y);
        return;
    }
    
    // Command mode handled by drag/mouseup usually, but single click works too if dragging didn't happen
    if (commandMode) {
        // No-op here, handled by MouseUp/Down logic for drag consistency
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
                if (p.status === 'Dead') return p;
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
      if (buildMode) {
          setIsDragging(true);
      } else if (commandMode && hoverPos) {
          setIsDragging(true);
          setDragStart(hoverPos);
      }
  };
  
  const handleMouseUp = () => {
      if (commandMode && dragStart && hoverPos) {
          // Determine bounds
          const x1 = Math.min(dragStart.x, hoverPos.x);
          const x2 = Math.max(dragStart.x, hoverPos.x);
          const y1 = Math.min(dragStart.y, hoverPos.y);
          const y2 = Math.max(dragStart.y, hoverPos.y);
          
          batchCommand(x1, y1, x2, y2);
      }
      
      setIsDragging(false);
      setDragStart(null);
  };

  const handleTileEnter = (x: number, y: number) => {
      setHoverPos({x, y});
      if (isDragging && buildMode) {
          buildAt(x, y);
      }
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
          targets = findBatchTargets(startStruct, activityId, structures);
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
      
      if (pawn && pawn.status !== 'Dead' && workJobs.length > 0) {
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
            skillXp: newPawnData.skillXp || {
                [SkillType.CONSTRUCTION]: 0,
                [SkillType.COOKING]: 0,
                [SkillType.PLANTS]: 0,
                [SkillType.MINING]: 0,
                [SkillType.SOCIAL]: 0,
                [SkillType.INTELLECTUAL]: 0,
                [SkillType.MELEE]: 0
            },
            color: `bg-${['red','green','blue','purple','yellow'][Math.floor(Math.random()*5)]}-500`,
            x: Math.floor(Math.random() * MAP_SIZE),
            y: Math.floor(Math.random() * MAP_SIZE),
            inventory: [],
            maxWeight: 35,
            currentJob: null,
            jobQueue: [],
            status: 'Idle',
            needs: { food: 100, sleep: 100, recreation: 100 },
            effects: newPawnData.effects || [],
            starvationTimer: 0,
            movementBuffer: 0
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
            commandMode={commandMode}
            dragStart={dragStart}
            hoverPos={hoverPos}
            setHoverPos={setHoverPos}
            queuedTargets={queuedTargets}
        />
        
        <ResourceHUD structures={structures} pawns={pawns} />
        
        <Sidebar 
            selectedPawn={selectedPawn}
            selectedStructure={selectedStructure}
            onOrderJob={handleOrderJob}
            buildMode={buildMode}
            setBuildMode={setBuildMode}
            commandMode={commandMode}
            setCommandMode={setCommandMode}
            pawns={pawns}
            isGeneratingPawn={isGeneratingPawn}
            onGeneratePawn={handleGeneratePawn}
        />
        <LogPanel logs={logs} />
    </div>
  );
};

export default App;