


export enum SkillType {
  CONSTRUCTION = 'Construction',
  COOKING = 'Cooking',
  PLANTS = 'Plants',
  MINING = 'Mining',
  SOCIAL = 'Social',
  INTELLECTUAL = 'Intellectual',
  MELEE = 'Melee'
}

export interface Skill {
  type: SkillType;
  level: number; // 0-20
}

export interface Item {
  id: string;
  name: string;
  weight: number;
  quantity: number;
}

export interface Needs {
  food: number;      // 0-100
  sleep: number;     // 0-100
  recreation: number;// 0-100
}

export type EffectType = 'WELL_RESTED' | 'SATED' | 'HUNGRY' | 'TIRED' | 'BORED' | 'JOY';

export interface PawnEffect {
  type: EffectType;
  label: string;
  duration: number; // Ticks remaining. -1 for infinite (until condition met)
  isPositive: boolean;
}

export interface Pawn {
  id: string;
  name: string;
  backstory: string;
  x: number;
  y: number;
  color: string;
  skills: Record<SkillType, number>;
  skillXp: Record<SkillType, number>; // Current XP for current level
  needs: Needs;
  inventory: Item[];
  maxWeight: number;
  currentJob: Job | null;
  jobQueue: Job[]; // Queue of future jobs
  status: string; // "Idle", "Moving", "Working", "Sleeping", "Eating", "Dead"
  
  // New Fields
  effects: PawnEffect[];
  starvationTimer: number; // Ticks spent starving
  movementBuffer: number; // Accumulator for sub-tile movement
}

export type ActivityType = 'CRAFT' | 'GATHER' | 'STORE' | 'WORK' | 'RECREATION';

export interface StructureDefinition {
  type: string;
  name: string;
  width: number;
  height: number;
  color: string;
  cost: { itemName: string; amount: number }[];
  activities: ActivityDefinition[];
  isNatural?: boolean; // If true, cannot be built by player, spawns naturally
}

export interface ActivityDefinition {
  id: string;
  name: string;
  actionType: ActivityType;
  requiredSkill: SkillType;
  requiredLevel: number;
  durationTicks: number; // How long it takes
  inputs?: { itemName: string; quantity: number }[]; // Ingredients required per iteration
  outputs?: { itemName: string; quantity: number }[]; // Simplified output
}

export interface CropData {
  type: 'RICE' | 'POTATO' | 'CORN';
  growth: number; // 0 to 100
  planted: boolean;
}

export interface Structure {
  id: string;
  type: string;
  x: number;
  y: number;
  inventory: Item[];
  isBlueprint?: boolean; // If true, it is under construction
  crop?: CropData; // For farms
  growth?: number; // For natural structures (Trees, Bushes) 0-100
  currentActivity?: {
    activityId: string;
    progress: number;
    workerId: string;
    repeatsLeft?: number; // How many times to repeat this activity
  };
}

export interface Job {
  id: string;
  type: 'MOVE' | 'WORK' | 'HAUL' | 'WITHDRAW' | 'SLEEP' | 'EAT';
  targetX?: number;
  targetY?: number;
  targetStructureId?: string;
  activityId?: string;
  activityRepeats?: number; // Number of times to do the activity
  itemsToHandle?: { itemName: string; quantity: number }[]; // For WITHDRAW/HAUL
  nextJob?: Job; // The job to start immediately after this one finishes
}

export interface LogEntry {
    id: string;
    timestamp: number;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
}