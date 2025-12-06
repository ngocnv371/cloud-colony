


import React, { useState, useEffect, useRef, useMemo } from 'react';
import GameMap from './components/GameMap';
import Sidebar from './components/Sidebar';
import LogPanel from './components/LogPanel';
import ResourceHUD from './components/ResourceHUD';
import TopBar from './components/TopBar';
import TerrainHUD from './components/TerrainHUD';
import { useGame } from './store/gameStore';
import { generateRandomPawn } from './services/geminiService';
import { STRUCTURES, CONSTRUCT_ACTIVITY_ID, HARVEST_ACTIVITY_ID, TICK_RATE_MS, MAP_SIZE } from './constants';
import { Structure, SkillType, Pawn, Job } from './types';

const App: React.FC = () => {
  const { state, dispatch } = useGame();
  
  // Mouse Interaction State (Transient, keeps performance high)
  const [hoverPos, setHoverPos] = useState<{x: number, y: number} | null>(null);
  const [dragStart, setDragStart] = useState<{x: number, y: number} | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // --- Derived State ---
  const queuedTargets = useMemo(() => {
    const targets = new Map<string, string>();
    state.globalJobQueue.forEach(j => {
        if(j.targetStructureId) targets.set(j.targetStructureId, j.activityId || j.type);
    });
    state.pawns.forEach(p => {
        if(p.currentJob?.targetStructureId) targets.set(p.currentJob.targetStructureId, p.currentJob.activityId || p.currentJob.type);
        p.jobQueue.forEach(j => {
             if(j.targetStructureId) targets.set(j.targetStructureId, j.activityId || j.type);
        });
    });
    return targets;
  }, [state.globalJobQueue, state.pawns]);

  // --- Game Loop ---
  useEffect(() => {
    const interval = setInterval(() => {
        dispatch({ type: 'TICK' });
    }, TICK_RATE_MS);
    return () => clearInterval(interval);
  }, [dispatch]);

  // --- Helpers ---
  const getCommandActivity = (structure: Structure, mode: 'HARVEST' | 'CHOP' | 'MINE' | null): string | null => {
      const def = STRUCTURES[structure.type];
      if (!def) return null;
      
      if (mode === 'CHOP' && def.type === 'TREE') return 'chop_wood';
      
      if (mode === 'HARVEST') {
          if (def.type === 'BERRY_BUSH') {
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

  const batchCommand = (x1: number, y1: number, x2: number, y2: number) => {
      if (!state.commandMode) return;
      
      const newJobs: Job[] = [];
      state.structures.forEach(s => {
          const isInBounds = s.x >= x1 && s.x <= x2 && s.y >= y1 && s.y <= y2;
          if (!isInBounds) return;

          const activityId = getCommandActivity(s, state.commandMode!);
          if (activityId) {
             const alreadyQueued = state.globalJobQueue.some(j => j.targetStructureId === s.id && j.activityId === activityId);
             const alreadyActive = s.currentActivity?.activityId === activityId;
             
             if (!alreadyQueued && !alreadyActive) {
                 newJobs.push({
                     id: `job-cmd-${Date.now()}-${s.id}`,
                     type: 'WORK',
                     targetStructureId: s.id,
                     activityId: activityId,
                     activityRepeats: 1
                 });
             }
          }
      });

      if (newJobs.length > 0) {
          dispatch({ type: 'BATCH_ORDER', jobs: newJobs });
      } else {
          dispatch({ type: 'ADD_LOG', message: `No valid targets for ${state.commandMode.toLowerCase()}`, severity: 'warning' });
      }
  };

  // --- Handlers ---
  const handleTileClick = (x: number, y: number) => {
    // 0. Preset Mode
    if (state.presetMode) {
        dispatch({ type: 'PLACE_PRESET', x, y });
        return;
    }

    // 1. Build Mode
    if (state.buildMode) {
        dispatch({ type: 'BUILD_STRUCTURE', x, y });
        return;
    }
    
    // Command Mode is handled by Drag, but single click logic could be here if needed
    if (state.commandMode) return;

    // 2. Unit Selection
    // If we click a pawn, we usually want to select it.
    const clickedPawn = state.pawns.find(p => p.x === x && p.y === y);

    if (clickedPawn) {
        // Toggle selection off if clicking the already selected pawn
        if (state.selectedPawnId === clickedPawn.id) {
            dispatch({ type: 'SELECT_PAWN', pawnId: null });
            return;
        }

        // Select new pawn if nothing is currently selected
        if (!state.selectedPawnId) {
            dispatch({ type: 'SELECT_PAWN', pawnId: clickedPawn.id });
            return;
        }
    }

    // 3. Structure Selection vs Movement
    const structuresAtTile = state.structures.filter(s => 
        x >= s.x && x < s.x + STRUCTURES[s.type].width &&
        y >= s.y && y < s.y + STRUCTURES[s.type].height
    );

    // Sort by Layer (Higher layer on top) so we prioritize visibility
    structuresAtTile.sort((a, b) => {
        const layerA = STRUCTURES[a.type]?.layer || 0;
        const layerB = STRUCTURES[b.type]?.layer || 0;
        return layerB - layerA; // Descending
    });

    if (state.selectedPawnId) {
        // MOVEMENT LOGIC
        // If a pawn is selected, we only select the structure if it is IMPASSABLE (e.g., Wall, Boulder).
        // If the structure is passable (Tree, Floor, etc.), we ignore selection and issue a MOVE command.
        
        // Find if there is any impassable structure here
        const impassableStructure = structuresAtTile.find(s => STRUCTURES[s.type]?.passable === false);

        if (impassableStructure) {
            // Clicked on a wall/boulder -> Select it (cannot walk there)
            dispatch({ type: 'SELECT_STRUCTURE', structureId: impassableStructure.id });
        } else {
            // Clicked on empty ground or passable structure -> Move there
            dispatch({ type: 'MOVE_PAWN', pawnId: state.selectedPawnId, x, y });
        }
    } else {
        // Selection Logic (No pawn selected)
        // Select the top-most structure
        if (structuresAtTile.length > 0) {
            dispatch({ type: 'SELECT_STRUCTURE', structureId: structuresAtTile[0].id });
        } else {
            // Deselect everything if clicking empty void
            dispatch({ type: 'SELECT_STRUCTURE', structureId: null });
            dispatch({ type: 'SELECT_PAWN', pawnId: null });
        }
    }
  };

  const handleMouseDown = () => {
      if (state.buildMode || state.commandMode || state.presetMode) {
          setIsDragging(true);
          setDragStart(hoverPos);
      }
  };
  
  const handleMouseUp = () => {
      if (state.commandMode && dragStart && hoverPos) {
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
      if (isDragging && state.buildMode) {
          dispatch({ type: 'BUILD_STRUCTURE', x, y });
      }
  };

  const handleGeneratePawn = async () => {
      dispatch({ type: 'START_PAWN_GENERATION' });
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
        dispatch({ type: 'COMPLETE_PAWN_GENERATION', newPawn });
      } catch (e) {
          console.error("Failed to generate pawn", e);
          dispatch({ type: 'FAIL_PAWN_GENERATION' });
      }
  };

  // Camera Focus
  const handleSelectPawn = (pawn: Pawn) => {
      dispatch({ type: 'SELECT_PAWN', pawnId: pawn.id });
      if (mapContainerRef.current) {
          const TILE_SIZE = 48;
          const container = mapContainerRef.current;
          const targetX = pawn.x * TILE_SIZE;
          const targetY = pawn.y * TILE_SIZE;
          container.scrollTo({
              left: targetX - container.clientWidth / 2 + TILE_SIZE / 2,
              top: targetY - container.clientHeight / 2 + TILE_SIZE / 2,
              behavior: 'smooth'
          });
      }
  };

  return (
    <div className="flex h-screen w-screen bg-black overflow-hidden font-sans" onMouseUp={handleMouseUp}>
        <TopBar onSelectPawn={handleSelectPawn} />
        
        <GameMap 
            ref={mapContainerRef}
            structures={state.structures}
            pawns={state.pawns}
            onTileClick={handleTileClick}
            onTileEnter={handleTileEnter}
            onMouseDown={handleMouseDown}
            selectedPawnId={state.selectedPawnId}
            selectedStructureId={state.selectedStructureId}
            buildPreview={state.buildMode}
            commandMode={state.commandMode}
            dragStart={dragStart}
            hoverPos={hoverPos}
            setHoverPos={setHoverPos}
            queuedTargets={queuedTargets}
        />
        
        <ResourceHUD />
        
        <Sidebar onGeneratePawn={handleGeneratePawn} />
        <LogPanel />
        <TerrainHUD hoverPos={hoverPos} terrain={state.terrain} structures={state.structures} />
    </div>
  );
};

export default App;
