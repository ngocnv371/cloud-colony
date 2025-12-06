

import { StructureDefinition, SkillType, Pawn, TerrainType } from './types';

export const MAP_SIZE = 25;
export const TICK_RATE_MS = 250;

export const CONSTRUCT_ACTIVITY_ID = 'construct_structure';
export const HARVEST_ACTIVITY_ID = 'harvest_crop';

// Natural Spawning Constants
export const NATURAL_SPAWN_CHANCE = 0.05; // 1% chance per tick to try spawning logic
export const NATURAL_GROWTH_RATE = 0.5; // +0.5% growth per tick (~50 seconds to mature)

// Needs Constants (Based on 250ms tick rate = 4 ticks/sec)
export const NEEDS = {
    DECAY: {
        FOOD: 0.416,       // 100 / 60s / 4 ticks = ~0.416 per tick
        SLEEP: 0.138,      // 100 / 180s / 4 ticks = ~0.138 per tick
        RECREATION: 0.138, // 100 / 180s / 4 ticks = ~0.138 per tick
    },
    REPLENISH: {
        SLEEP: 0.5,        // +2 per second
        RECREATION: 0.5,   // +2 per second
        EAT: 100           // Instant fill
    },
    CRITICAL: {
        SLEEP: 10,
        FOOD: 15,
        RECREATION: 20
    }
};

export const FOOD_ITEMS: Record<string, number> = {
    'Simple Meal': 100,
    'Fine Meal': 100,
    'Berries': 50,
    'Corn': 50,
    'Potato': 45,
    'Rice': 40
};

export const EFFECT_DURATION_TICKS = 240;
export const STARVATION_DEATH_TICKS = 480;
export const JOY_DURATION_TICKS = 12000;

export const getLevelRequirement = (level: number) => {
    return 100 * (level + 1);
};

export const CROPS = {
    RICE: { name: 'Rice', growRate: 2.5, yield: 6 },
    POTATO: { name: 'Potato', growRate: 1.5, yield: 10 },
    CORN: { name: 'Corn', growRate: 0.8, yield: 22 },
};

// Terrain Definitions (Layer 0)
export const TERRAIN_DEFINITIONS: Record<TerrainType, { color: string, speedMult: number, label: string }> = {
    [TerrainType.SOIL]: { color: 'bg-[#3a4a35]', speedMult: 1.0, label: 'Soil' },
    [TerrainType.STONE]: { color: 'bg-stone-600', speedMult: 1.0, label: 'Rough Stone' },
    [TerrainType.WATER_SHALLOW]: { color: 'bg-blue-500/50', speedMult: 0.7, label: 'Shallow Water' },
    [TerrainType.WATER_DEEP]: { color: 'bg-blue-800', speedMult: 0.2, label: 'Deep Water' },
    [TerrainType.LAVA]: { color: 'bg-red-600', speedMult: 0.3, label: 'Lava' },
    [TerrainType.MARSH]: { color: 'bg-emerald-900', speedMult: 0.6, label: 'Marsh' },
};

export const STRUCTURES: Record<string, StructureDefinition> = {
  // --- Floors (Layer 1) ---
  WOOD_FLOOR: {
      type: 'WOOD_FLOOR',
      name: 'Wood Floor',
      width: 1,
      height: 1,
      color: 'bg-amber-800/80', // Slightly transparent to blend if needed, or opaque
      layer: 1,
      passable: true,
      walkSpeedMultiplier: 1.1,
      cost: [{ itemName: 'Wood', amount: 3 }],
      activities: []
  },
  STONE_TILE: {
      type: 'STONE_TILE',
      name: 'Stone Tile',
      width: 1,
      height: 1,
      color: 'bg-stone-400',
      layer: 1,
      passable: true,
      walkSpeedMultiplier: 1.1,
      cost: [{ itemName: 'Stone', amount: 4 }],
      activities: []
  },
  CONCRETE: {
      type: 'CONCRETE',
      name: 'Concrete',
      width: 1,
      height: 1,
      color: 'bg-gray-400',
      layer: 1,
      passable: true,
      walkSpeedMultiplier: 1.2,
      cost: [{ itemName: 'Steel', amount: 1 }],
      activities: []
  },

  // --- Structures (Layer 5) ---
  WOOD_WALL: {
    type: 'WOOD_WALL',
    name: 'Wood Wall',
    width: 1,
    height: 1,
    color: 'bg-amber-900',
    layer: 5,
    passable: false,
    cost: [{ itemName: 'Wood', amount: 5 }],
    activities: []
  },
  STONE_WALL: {
    type: 'STONE_WALL',
    name: 'Stone Wall',
    width: 1,
    height: 1,
    color: 'bg-stone-500',
    layer: 5,
    passable: false,
    cost: [{ itemName: 'Stone', amount: 5 }],
    activities: []
  },
  STEEL_WALL: {
    type: 'STEEL_WALL',
    name: 'Steel Wall',
    width: 1,
    height: 1,
    color: 'bg-slate-500',
    layer: 5,
    passable: false,
    cost: [{ itemName: 'Steel', amount: 5 }],
    activities: []
  },
  WOOD_DOOR: {
    type: 'WOOD_DOOR',
    name: 'Wood Door',
    width: 1,
    height: 1,
    color: 'bg-amber-600',
    layer: 5,
    passable: true,
    walkSpeedMultiplier: 0.8,
    cost: [{ itemName: 'Wood', amount: 5 }],
    activities: []
  },
  BED: {
    type: 'BED',
    name: 'Bed',
    width: 1,
    height: 2, // Vertical
    color: 'bg-blue-700',
    layer: 5,
    passable: true,
    walkSpeedMultiplier: 0.6,
    cost: [{ itemName: 'Wood', amount: 20 }],
    activities: [
        {
            id: 'sleep_in_bed',
            name: 'Sleep',
            actionType: 'RECREATION',
            requiredSkill: SkillType.CONSTRUCTION,
            requiredLevel: 0,
            durationTicks: 100
        }
    ]
  },
  TABLE: {
    type: 'TABLE',
    name: 'Table',
    width: 2,
    height: 1,
    color: 'bg-amber-800',
    layer: 5,
    passable: false,
    cost: [{ itemName: 'Wood', amount: 15 }],
    activities: []
  },
  CHAIR: {
    type: 'CHAIR',
    name: 'Chair',
    width: 1,
    height: 1,
    color: 'bg-amber-700',
    layer: 5,
    passable: true,
    walkSpeedMultiplier: 0.9,
    cost: [{ itemName: 'Wood', amount: 5 }],
    activities: [
        {
            id: 'sit_in_chair',
            name: 'Sit',
            actionType: 'RECREATION',
            requiredSkill: SkillType.SOCIAL,
            requiredLevel: 0,
            durationTicks: 50
        }
    ]
  },
  CAMPFIRE: {
    type: 'CAMPFIRE',
    name: 'Campfire',
    width: 1,
    height: 1,
    color: 'bg-orange-600',
    layer: 5,
    passable: false,
    cost: [{ itemName: 'Wood', amount: 10 }],
    activities: [
      {
        id: 'cook_simple',
        name: 'Cook Simple Meal',
        actionType: 'CRAFT',
        requiredSkill: SkillType.COOKING,
        requiredLevel: 0,
        durationTicks: 10,
        inputs: [{ itemName: 'Berries', quantity: 5 }],
        outputs: [{ itemName: 'Simple Meal', quantity: 1 }]
      },
      {
        id: 'cook_fine',
        name: 'Cook Fine Meal',
        actionType: 'CRAFT',
        requiredSkill: SkillType.COOKING,
        requiredLevel: 5,
        durationTicks: 20,
        inputs: [{ itemName: 'Raw Meat', quantity: 5 }],
        outputs: [{ itemName: 'Fine Meal', quantity: 1 }]
      }
    ]
  },
  BUTCHER_TABLE: {
    type: 'BUTCHER_TABLE',
    name: 'Butcher Table',
    width: 2,
    height: 1,
    color: 'bg-red-900',
    layer: 5,
    passable: false,
    cost: [{ itemName: 'Wood', amount: 20 }],
    activities: [
      {
        id: 'butcher_creature',
        name: 'Butcher Creature',
        actionType: 'CRAFT',
        requiredSkill: SkillType.COOKING,
        requiredLevel: 2,
        durationTicks: 15,
        inputs: [],
        outputs: [{ itemName: 'Raw Meat', quantity: 10 }]
      }
    ]
  },
  RESEARCH_BENCH: {
    type: 'RESEARCH_BENCH',
    name: 'Research Bench',
    width: 2,
    height: 2,
    color: 'bg-blue-800',
    layer: 5,
    passable: false,
    cost: [{ itemName: 'Wood', amount: 30 }, { itemName: 'Steel', amount: 10 }],
    activities: [
      {
        id: 'research_basic',
        name: 'Conduct Research',
        actionType: 'CRAFT',
        requiredSkill: SkillType.INTELLECTUAL,
        requiredLevel: 3,
        durationTicks: 40,
        outputs: []
      }
    ]
  },
  WORKBENCH: {
    type: 'WORKBENCH',
    name: 'Workbench',
    width: 2,
    height: 1,
    color: 'bg-amber-700',
    layer: 5,
    passable: false,
    cost: [{ itemName: 'Wood', amount: 25 }],
    activities: [
      {
        id: 'craft_club',
        name: 'Craft Club',
        actionType: 'CRAFT',
        requiredSkill: SkillType.CONSTRUCTION,
        requiredLevel: 2,
        durationTicks: 30,
        inputs: [{ itemName: 'Wood', quantity: 10 }],
        outputs: [{ itemName: 'Wooden Club', quantity: 1 }]
      }
    ]
  },
  CHESS_TABLE: {
    type: 'CHESS_TABLE',
    name: 'Chess Table',
    width: 1,
    height: 1,
    color: 'bg-neutral-800',
    layer: 5,
    passable: false, // Players stand next to it
    cost: [{ itemName: 'Wood', amount: 20 }, { itemName: 'Steel', amount: 5 }],
    activities: [
        {
            id: 'play_chess',
            name: 'Play Chess',
            actionType: 'RECREATION',
            requiredSkill: SkillType.INTELLECTUAL,
            requiredLevel: 0,
            durationTicks: 40,
            outputs: []
        }
    ]
  },
  WOODEN_POLE: {
    type: 'WOODEN_POLE',
    name: 'Wooden Dummy',
    width: 1,
    height: 1,
    color: 'bg-amber-500',
    layer: 5,
    passable: false,
    cost: [{ itemName: 'Wood', amount: 20 }],
    activities: [
        {
            id: 'practice_kungfu',
            name: 'Practice Kung Fu',
            actionType: 'RECREATION',
            requiredSkill: SkillType.MELEE,
            requiredLevel: 0,
            durationTicks: 30,
            outputs: []
        }
    ]
  },
  CHEST: {
    type: 'CHEST',
    name: 'Storage Chest',
    width: 1,
    height: 1,
    color: 'bg-amber-950',
    layer: 5,
    passable: false,
    cost: [{ itemName: 'Wood', amount: 15 }],
    activities: [
        {
            id: 'stock_items',
            name: 'Stock All Items',
            actionType: 'STORE',
            requiredSkill: SkillType.SOCIAL,
            requiredLevel: 0,
            durationTicks: 5,
            outputs: []
        }
    ]
  },
  FARM_PLOT: {
      type: 'FARM_PLOT',
      name: 'Farm Plot',
      width: 1,
      height: 1,
      color: 'bg-amber-900', // Earth color
      layer: 1, // On the ground
      passable: true,
      cost: [], // Free to place plot
      activities: [
          {
              id: 'plant_rice',
              name: 'Plant Rice',
              actionType: 'WORK',
              requiredSkill: SkillType.PLANTS,
              requiredLevel: 0,
              durationTicks: 10,
              outputs: []
          },
          {
              id: 'plant_potato',
              name: 'Plant Potato',
              actionType: 'WORK',
              requiredSkill: SkillType.PLANTS,
              requiredLevel: 3,
              durationTicks: 12,
              outputs: []
          },
          {
              id: 'plant_corn',
              name: 'Plant Corn',
              actionType: 'WORK',
              requiredSkill: SkillType.PLANTS,
              requiredLevel: 5,
              durationTicks: 15,
              outputs: []
          },
          {
              id: HARVEST_ACTIVITY_ID,
              name: 'Harvest Crop',
              actionType: 'GATHER',
              requiredSkill: SkillType.PLANTS,
              requiredLevel: 0,
              durationTicks: 15,
              outputs: []
          }
      ]
  },
  TREE: {
      type: 'TREE',
      name: 'Tree',
      width: 1,
      height: 1,
      color: 'bg-green-800',
      isNatural: true,
      layer: 5,
      passable: true, // Can walk under trees
      cost: [],
      activities: [
          {
              id: 'chop_wood',
              name: 'Chop Wood',
              actionType: 'GATHER',
              requiredSkill: SkillType.PLANTS,
              requiredLevel: 0,
              durationTicks: 20,
              outputs: [{ itemName: 'Wood', quantity: 15 }]
          },
          {
              id: 'climb_tree',
              name: 'Climb Tree',
              actionType: 'RECREATION',
              requiredSkill: SkillType.MELEE,
              requiredLevel: 0,
              durationTicks: 25
          },
          {
              id: 'hug_tree',
              name: 'Hug Tree',
              actionType: 'RECREATION',
              requiredSkill: SkillType.SOCIAL,
              requiredLevel: 0,
              durationTicks: 15
          }
      ]
  },
  BERRY_BUSH: {
      type: 'BERRY_BUSH',
      name: 'Berry Bush',
      width: 1,
      height: 1,
      color: 'bg-green-600',
      isNatural: true,
      layer: 5,
      passable: true,
      cost: [],
      activities: [
          {
              id: 'harvest_berry',
              name: 'Harvest Berries',
              actionType: 'GATHER',
              requiredSkill: SkillType.PLANTS,
              requiredLevel: 0,
              durationTicks: 10,
              outputs: [{ itemName: 'Berries', quantity: 8 }]
          },
          {
              id: 'hide_in_bush',
              name: 'Hide in Bush',
              actionType: 'RECREATION',
              requiredSkill: SkillType.PLANTS,
              requiredLevel: 0,
              durationTicks: 20
          }
      ]
  },
  // --- Mining Resources ---
  BOULDER: {
    type: 'BOULDER',
    name: 'Boulder',
    width: 1,
    height: 1,
    color: 'bg-stone-600',
    isNatural: true,
    layer: 5,
    passable: false,
    cost: [],
    activities: [
        {
            id: 'mine_stone',
            name: 'Mine Stone',
            actionType: 'GATHER',
            requiredSkill: SkillType.MINING,
            requiredLevel: 0,
            durationTicks: 25,
            outputs: [{ itemName: 'Stone', quantity: 20 }]
        },
        {
            id: 'climb_boulder',
            name: 'Climb Boulder',
            actionType: 'RECREATION',
            requiredSkill: SkillType.MELEE,
            requiredLevel: 0,
            durationTicks: 25
        },
        {
            id: 'watch_clouds',
            name: 'Watch Clouds',
            actionType: 'RECREATION',
            requiredSkill: SkillType.INTELLECTUAL,
            requiredLevel: 0,
            durationTicks: 30
        }
    ]
  },
  STEEL_VEIN: {
    type: 'STEEL_VEIN',
    name: 'Steel Vein',
    width: 1,
    height: 1,
    color: 'bg-slate-700',
    isNatural: true,
    layer: 5,
    passable: false,
    cost: [],
    activities: [
        {
            id: 'mine_steel',
            name: 'Mine Steel',
            actionType: 'GATHER',
            requiredSkill: SkillType.MINING,
            requiredLevel: 2,
            durationTicks: 30,
            outputs: [{ itemName: 'Steel', quantity: 15 }]
        }
    ]
  },
  SILVER_VEIN: {
    type: 'SILVER_VEIN',
    name: 'Silver Vein',
    width: 1,
    height: 1,
    color: 'bg-slate-500',
    isNatural: true,
    layer: 5,
    passable: false,
    cost: [],
    activities: [
        {
            id: 'mine_silver',
            name: 'Mine Silver',
            actionType: 'GATHER',
            requiredSkill: SkillType.MINING,
            requiredLevel: 4,
            durationTicks: 35,
            outputs: [{ itemName: 'Silver', quantity: 10 }]
        }
    ]
  },
  GOLD_VEIN: {
    type: 'GOLD_VEIN',
    name: 'Gold Vein',
    width: 1,
    height: 1,
    color: 'bg-yellow-800',
    isNatural: true,
    layer: 5,
    passable: false,
    cost: [],
    activities: [
        {
            id: 'mine_gold',
            name: 'Mine Gold',
            actionType: 'GATHER',
            requiredSkill: SkillType.MINING,
            requiredLevel: 6,
            durationTicks: 40,
            outputs: [{ itemName: 'Gold', quantity: 5 }]
        }
    ]
  },
  URANIUM_VEIN: {
    type: 'URANIUM_VEIN',
    name: 'Uranium Vein',
    width: 1,
    height: 1,
    color: 'bg-green-900',
    isNatural: true,
    layer: 5,
    passable: false,
    cost: [],
    activities: [
        {
            id: 'mine_uranium',
            name: 'Mine Uranium',
            actionType: 'GATHER',
            requiredSkill: SkillType.MINING,
            requiredLevel: 8,
            durationTicks: 50,
            outputs: [{ itemName: 'Uranium', quantity: 5 }]
        }
    ]
  }
};

const initialSkills = {
  [SkillType.CONSTRUCTION]: 0,
  [SkillType.COOKING]: 0,
  [SkillType.PLANTS]: 0,
  [SkillType.MINING]: 0,
  [SkillType.SOCIAL]: 0,
  [SkillType.INTELLECTUAL]: 0,
  [SkillType.MELEE]: 0
};

export const INITIAL_PAWNS: Partial<Pawn>[] = [
  {
    name: 'Crash',
    color: 'bg-blue-400',
    skills: {
      [SkillType.CONSTRUCTION]: 5,
      [SkillType.COOKING]: 2,
      [SkillType.PLANTS]: 1,
      [SkillType.MINING]: 3,
      [SkillType.SOCIAL]: 3,
      [SkillType.INTELLECTUAL]: 0,
      [SkillType.MELEE]: 4
    },
    skillXp: { ...initialSkills }
  },
  {
    name: 'Serenity',
    color: 'bg-pink-400',
    skills: {
      [SkillType.CONSTRUCTION]: 2,
      [SkillType.COOKING]: 5,
      [SkillType.PLANTS]: 8,
      [SkillType.MINING]: 1,
      [SkillType.SOCIAL]: 5,
      [SkillType.INTELLECTUAL]: 2,
      [SkillType.MELEE]: 1
    },
    skillXp: { ...initialSkills }
  }
];
