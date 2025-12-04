import { StructureDefinition, SkillType } from './types';

export const STRUCTURES: Record<string, StructureDefinition> = {
  WALL: {
    type: 'WALL',
    name: 'Wall',
    width: 1,
    height: 1,
    color: 'bg-stone-500',
    cost: [],
    activities: []
  },
  CAMPFIRE: {
    type: 'CAMPFIRE',
    name: 'Campfire',
    width: 1,
    height: 1,
    color: 'bg-orange-500',
    cost: [],
    activities: [
      {
        id: 'cook_simple',
        name: 'Cook Simple Meal',
        requiredSkill: SkillType.COOKING,
        requiredLevel: 0,
        durationTicks: 10,
        outputs: [{ itemName: 'Simple Meal', quantity: 1 }]
      },
      {
        id: 'cook_fine',
        name: 'Cook Fine Meal',
        requiredSkill: SkillType.COOKING,
        requiredLevel: 5,
        durationTicks: 20,
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
    cost: [],
    activities: [
      {
        id: 'butcher_creature',
        name: 'Butcher Creature',
        requiredSkill: SkillType.COOKING,
        requiredLevel: 2,
        durationTicks: 15,
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
    cost: [],
    activities: [
      {
        id: 'research_basic',
        name: 'Conduct Research',
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
    cost: [],
    activities: [
      {
        id: 'craft_club',
        name: 'Craft Club',
        requiredSkill: SkillType.CONSTRUCTION,
        requiredLevel: 2,
        durationTicks: 30,
        outputs: [{ itemName: 'Wooden Club', quantity: 1 }]
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