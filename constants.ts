
import { StructureDefinition, SkillType } from './types';

export const CONSTRUCT_ACTIVITY_ID = 'construct_structure';
export const HARVEST_ACTIVITY_ID = 'harvest_crop';

export const CROPS = {
    RICE: { name: 'Rice', growRate: 2.5, yield: 6 }, // Fast, low yield
    POTATO: { name: 'Potato', growRate: 1.5, yield: 10 }, // Medium
    CORN: { name: 'Corn', growRate: 0.8, yield: 22 }, // Slow, high yield
};

export const STRUCTURES: Record<string, StructureDefinition> = {
  WALL: {
    type: 'WALL',
    name: 'Wall',
    width: 1,
    height: 1,
    color: 'bg-stone-500',
    cost: [{ itemName: 'Wood', amount: 5 }],
    activities: []
  },
  CAMPFIRE: {
    type: 'CAMPFIRE',
    name: 'Campfire',
    width: 1,
    height: 1,
    color: 'bg-orange-500',
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
    color: 'bg-red-800',
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
    color: 'bg-blue-700',
    cost: [{ itemName: 'Wood', amount: 30 }, { itemName: 'Iron', amount: 10 }],
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
    color: 'bg-amber-600',
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
  CHEST: {
    type: 'CHEST',
    name: 'Storage Chest',
    width: 1,
    height: 1,
    color: 'bg-amber-800',
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
              outputs: [] // Dynamic output handled in App.tsx
          }
      ]
  },
  TREE: {
      type: 'TREE',
      name: 'Tree',
      width: 1,
      height: 1,
      color: 'bg-green-700',
      isNatural: true,
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
          }
      ]
  },
  BERRY_BUSH: {
      type: 'BERRY_BUSH',
      name: 'Berry Bush',
      width: 1,
      height: 1,
      color: 'bg-green-500',
      isNatural: true,
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
          }
      ]
  }
};

export const INITIAL_PAWNS = [
  {
    name: 'Crash',
    color: 'bg-blue-400',
    skills: {
      [SkillType.CONSTRUCTION]: 5,
      [SkillType.COOKING]: 2,
      [SkillType.PLANTS]: 1,
      [SkillType.MINING]: 0,
      [SkillType.SOCIAL]: 3,
      [SkillType.INTELLECTUAL]: 0,
      [SkillType.MELEE]: 4
    }
  },
  {
    name: 'Serenity',
    color: 'bg-pink-400',
    skills: {
      [SkillType.CONSTRUCTION]: 2,
      [SkillType.COOKING]: 5,
      [SkillType.PLANTS]: 8,
      [SkillType.MINING]: 0,
      [SkillType.SOCIAL]: 5,
      [SkillType.INTELLECTUAL]: 2,
      [SkillType.MELEE]: 1
    }
  }
];
