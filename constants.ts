
import { StructureDefinition, SkillType } from './types';

export const CONSTRUCT_ACTIVITY_ID = 'construct_structure';

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
        inputs: [], // Simplified: For MVP, maybe assume corpse is "gathered" or available
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
        outputs: [] // Just grants XP conceptually
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
            requiredSkill: SkillType.SOCIAL, // Basic organizational skill
            requiredLevel: 0,
            durationTicks: 5,
            outputs: []
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
  }
];
