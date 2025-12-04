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

export interface Pawn {
  id: string;
  name: string;
  backstory: string;
  x: number;
  y: number;
  color: string;
  skills: Record<SkillType, number>;
  inventory: Item[];
  maxWeight: number;
  currentJob: Job | null;
  status: string; // "Idle", "Moving", "Working"
}

export interface StructureDefinition {
  type: string;
  name: string;
  width: number;
  height: number;
  color: string;
  cost: { itemName: string; amount: number }[];
  activities: ActivityDefinition[];
}

export interface ActivityDefinition {
  id: string;
  name: string;
  requiredSkill: SkillType;
  requiredLevel: number;
  durationTicks: number; // How long it takes
  outputs?: { itemName: string; quantity: number }[]; // Simplified output
}

export interface Structure {
  id: string;
  type: string;
  x: number;
  y: number;
  currentActivity?: {
    activityId: string;
    progress: number;
    workerId: string;
  };
}

export interface Job {
  id: string;
  type: 'MOVE' | 'WORK' | 'HAUL';
  targetX?: number;
  targetY?: number;
  targetStructureId?: string;
  activityId?: string;
}

export const MAP_SIZE = 25;
export const TICK_RATE_MS = 250;