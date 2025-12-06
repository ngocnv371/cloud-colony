

import React, { createContext, useContext, useReducer, ReactNode, Dispatch } from 'react';
import { Pawn, Structure, Job, LogEntry, StructureDefinition, SkillType, TerrainType } from '../types';
import { INITIAL_PAWNS, JOY_DURATION_TICKS, CONSTRUCT_ACTIVITY_ID, STRUCTURES, NATURAL_SPAWN_CHANCE, MAP_SIZE } from '../constants';
import { generateInitialStructures, findBatchTargets, generateTerrain } from '../utils/mapUtils';
import { processPawns, assignJobToPawn } from '../systems/pawnLogic';
import { processStructures } from '../systems/structureLogic';

// --- State Definition ---
export interface GameState {
  terrain: TerrainType[];
  pawns: Pawn[];
  structures: Structure[];
  globalJobQueue: Job[];
  logs: LogEntry[];
  
  // UI / Selection State
  selectedPawnId: string | null;
  selectedStructureId: string | null;
  buildMode: StructureDefinition | null;
  commandMode: 'HARVEST' | 'CHOP' | 'MINE' | null;
  isGeneratingPawn: boolean;
}

// --- Actions ---
export type GameAction = 
  | { type: 'TICK' }
  | { type: 'SELECT_PAWN'; pawnId: string | null }
  | { type: 'SELECT_STRUCTURE'; structureId: string | null }
  | { type: 'SET_BUILD_MODE'; def: StructureDefinition | null }
  | { type: 'SET_COMMAND_MODE'; mode: 'HARVEST' | 'CHOP' | 'MINE' | null }
  | { type: 'ADD_LOG'; message: string; severity?: 'info' | 'success' | 'warning' | 'error' }
  | { type: 'BUILD_STRUCTURE'; x: number; y: number }
  | { type: 'ORDER_JOB'; pawnId: string | null; structureId: string; activityId: string; count: number }
  | { type: 'BATCH_ORDER'; jobs: Job[] }
  | { type: 'MOVE_PAWN'; pawnId: string; x: number; y: number }
  | { type: 'START_PAWN_GENERATION' }
  | { type: 'COMPLETE_PAWN_GENERATION'; newPawn: Pawn }
  | { type: 'FAIL_PAWN_GENERATION' };

// --- Initial State ---
const initialTerrain = generateTerrain();
const initialStructures = generateInitialStructures(initialTerrain);

const initialState: GameState = {
  terrain: initialTerrain,
  pawns: INITIAL_PAWNS.map((p, i) => ({
    id: `pawn-${i}`,
    ...p,
    x: 12 + i,
    y: 12,
    inventory: [],
    maxWeight: 35,
    currentJob: null,
    jobQueue: [],
    status: 'Idle',
    needs: { food: 100, sleep: 100, recreation: 100 },
    effects: [{ type: 'JOY', label: 'Joy', duration: JOY_DURATION_TICKS, isPositive: true }],
    starvationTimer: 0,
    movementBuffer: 0
  })) as Pawn[],
  structures: initialStructures,
  globalJobQueue: [],
  logs: [],
  selectedPawnId: null,
  selectedStructureId: null,
  buildMode: null,
  commandMode: null,
  isGeneratingPawn: false
};

// --- Helper for Logs ---
const createLog = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): LogEntry => ({
    id: `log-${Date.now()}-${Math.random()}`,
    timestamp: Date.now(),
    message,
    type
});

// --- Reducer ---
function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'TICK': {
      // 0. Natural Spawning
      let structuresAfterSpawn = state.structures;
      if (Math.random() < NATURAL_SPAWN_CHANCE) {
          const type = Math.random() > 0.6 ? 'TREE' : 'BERRY_BUSH';
          const x = Math.floor(Math.random() * MAP_SIZE);
          const y = Math.floor(Math.random() * MAP_SIZE);
          
          // Check for collision on same layer
          // We only spawn natural stuff on layer 5 (Objects)
          const layer = 5; 
          const occupied = state.structures.some(s => s.x === x && s.y === y && STRUCTURES[s.type].layer === layer);
          const terrainType = state.terrain[y * MAP_SIZE + x];
          const isWater = terrainType === TerrainType.WATER_DEEP || terrainType === TerrainType.WATER_SHALLOW || terrainType === TerrainType.LAVA;

          if (!occupied && !isWater) {
              const newStruct: Structure = {
                  id: `${type.toLowerCase()}-${Date.now()}-${Math.random()}`,
                  type,
                  x,
                  y,
                  inventory: [],
                  growth: 0
              };
              structuresAfterSpawn = [...state.structures, newStruct];
          }
      }

      // 1. Process Pawns (Pass Terrain!)
      const { nextPawns: intermediatePawns, nextQueue: queueAfterPawns, logs: pawnLogs } = processPawns(state.pawns, structuresAfterSpawn, state.globalJobQueue, state.terrain);
      
      // 2. Process Structures
      const { nextStructures, nextPawns: finalPawns, logs: structureLogs } = processStructures(structuresAfterSpawn, intermediatePawns);

      // Convert system logs to store logs
      const newLogs = [...pawnLogs, ...structureLogs].map(l => createLog(l.message, l.type));
      
      return {
        ...state,
        pawns: finalPawns,
        structures: nextStructures,
        globalJobQueue: queueAfterPawns,
        logs: newLogs.length > 0 ? [...state.logs.slice(-49), ...newLogs] : state.logs
      };
    }

    case 'SELECT_PAWN':
      return { 
          ...state, 
          selectedPawnId: action.pawnId, 
          selectedStructureId: null,
          buildMode: null,
          commandMode: null
      };

    case 'SELECT_STRUCTURE':
      return { 
          ...state, 
          selectedStructureId: action.structureId, 
          selectedPawnId: null,
          buildMode: null,
          commandMode: null
      };

    case 'SET_BUILD_MODE':
      return { ...state, buildMode: action.def, commandMode: null, selectedPawnId: null, selectedStructureId: null };

    case 'SET_COMMAND_MODE':
      return { ...state, commandMode: action.mode, buildMode: null, selectedPawnId: null, selectedStructureId: null };

    case 'ADD_LOG':
      return { 
          ...state, 
          logs: [...state.logs.slice(-49), createLog(action.message, action.severity)] 
      };

    case 'BUILD_STRUCTURE': {
        if (!state.buildMode) return state;
        
        // Layer Collision Check
        // Can only build if no structure on same layer
        const targetLayer = state.buildMode.layer;
        
        const collision = state.structures.find(s => 
            s.x === action.x && s.y === action.y &&
            STRUCTURES[s.type].layer === targetLayer
        );
        
        // Also check terrain (Cannot build on Deep Water or Lava)
        const t = state.terrain[action.y * MAP_SIZE + action.x];
        const invalidTerrain = t === TerrainType.WATER_DEEP || t === TerrainType.LAVA;

        if (collision || invalidTerrain) return state;

        const newStruct: Structure = {
            id: `struct-${Date.now()}-${Math.random()}`,
            type: state.buildMode.type,
            x: action.x,
            y: action.y,
            inventory: [],
            isBlueprint: true 
        };
        
        const newJob: Job = {
            id: `job-construct-${newStruct.id}`,
            type: 'WORK',
            targetStructureId: newStruct.id,
            activityId: CONSTRUCT_ACTIVITY_ID,
            activityRepeats: 1
        };

        return {
            ...state,
            structures: [...state.structures, newStruct],
            globalJobQueue: [...state.globalJobQueue, newJob],
            logs: [...state.logs.slice(-49), createLog(`Placed & queued ${state.buildMode.name}`)]
        };
    }

    case 'ORDER_JOB': {
        const startStruct = state.structures.find(s => s.id === action.structureId);
        if (!startStruct) return state;

        // Batch Logic
        const isBatchable = 
            action.activityId === CONSTRUCT_ACTIVITY_ID || 
            action.activityId === 'harvest_crop' || 
            action.activityId.startsWith('plant_');

        let targets: Structure[] = [startStruct];
        if (isBatchable) {
            targets = findBatchTargets(startStruct, action.activityId, state.structures);
        }

        const workJobs: Job[] = targets.map(target => ({
            id: `job-work-${Date.now()}-${target.id}`,
            type: 'WORK',
            targetStructureId: target.id,
            activityId: action.activityId,
            activityRepeats: action.count
        }));

        let newPawns = [...state.pawns];
        let newQueue = [...state.globalJobQueue];
        let newStructures = [...state.structures];
        let logMessage = `Ordered: ${action.activityId}`;

        // Attempt immediate assignment if a pawn is specified
        let pawnAssigned = false;
        if (action.pawnId) {
            const pawnIdx = newPawns.findIndex(p => p.id === action.pawnId);
            if (pawnIdx !== -1 && newPawns[pawnIdx].status !== 'Dead' && workJobs.length > 0) {
                 const assignedPawn = assignJobToPawn(newPawns[pawnIdx], workJobs[0], state.structures);
                 if (assignedPawn) {
                     newPawns[pawnIdx] = assignedPawn;
                     pawnAssigned = true;
                     logMessage += ` (assigned to ${assignedPawn.name})`;

                     // Visual feedback
                     const structIdx = newStructures.findIndex(s => s.id === targets[0].id);
                     if (structIdx !== -1) {
                        newStructures[structIdx] = {
                            ...newStructures[structIdx],
                            currentActivity: {
                                activityId: action.activityId,
                                progress: 0,
                                workerId: assignedPawn.id,
                                repeatsLeft: action.count
                            }
                        };
                     }
                 }
            }
        }

        const jobsToQueue = pawnAssigned ? workJobs.slice(1) : workJobs;
        newQueue = [...newQueue, ...jobsToQueue];
        if (targets.length > 1) logMessage += ` on ${targets.length} targets`;

        return {
            ...state,
            pawns: newPawns,
            structures: newStructures,
            globalJobQueue: newQueue,
            logs: [...state.logs.slice(-49), createLog(logMessage, 'success')]
        };
    }

    case 'BATCH_ORDER': {
        return {
            ...state,
            globalJobQueue: [...state.globalJobQueue, ...action.jobs],
            logs: [...state.logs.slice(-49), createLog(`Queued ${action.jobs.length} orders`, 'success')]
        };
    }

    case 'MOVE_PAWN': {
        const newPawns = state.pawns.map(p => {
            if (p.id === action.pawnId) {
                if (p.status === 'Dead') return p;
                return {
                    ...p,
                    currentJob: {
                        id: `job-${Date.now()}`,
                        type: 'MOVE',
                        targetX: action.x,
                        targetY: action.y
                    },
                    jobQueue: [],
                    status: 'Moving'
                } as Pawn;
            }
            return p;
        });
        
        const pawnName = state.pawns.find(p => p.id === action.pawnId)?.name || 'Pawn';

        return {
            ...state,
            pawns: newPawns,
            selectedStructureId: null,
            logs: [...state.logs.slice(-49), createLog(`[${pawnName}] Moving to (${action.x},${action.y})`)]
        };
    }

    case 'START_PAWN_GENERATION':
        return { ...state, isGeneratingPawn: true };
    
    case 'COMPLETE_PAWN_GENERATION':
        return { 
            ...state, 
            isGeneratingPawn: false,
            pawns: [...state.pawns, action.newPawn],
            logs: [...state.logs.slice(-49), createLog(`Recruited ${action.newPawn.name}: ${action.newPawn.backstory}`, 'success')]
        };

    case 'FAIL_PAWN_GENERATION':
        return { 
            ...state, 
            isGeneratingPawn: false,
            logs: [...state.logs.slice(-49), createLog("Failed to generate pawn", 'error')]
        };

    default:
      return state;
  }
}

// --- Context ---
const GameContext = createContext<{ state: GameState; dispatch: Dispatch<GameAction> } | null>(null);

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  return <GameContext.Provider value={{ state, dispatch }}>{children}</GameContext.Provider>;
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) throw new Error("useGame must be used within a GameProvider");
  return context;
};
