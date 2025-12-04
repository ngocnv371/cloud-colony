import { Structure, MAP_SIZE } from '../types';
import { CONSTRUCT_ACTIVITY_ID, HARVEST_ACTIVITY_ID } from '../constants';

export const generateInitialStructures = (): Structure[] => {
    const initialStructures: Structure[] = [];
    const spawnRandom = (type: string, count: number) => {
        for(let i=0; i<count; i++) {
          let x, y;
          // Simple overlap check limit
          for(let attempt=0; attempt<10; attempt++) {
              x = Math.floor(Math.random() * MAP_SIZE);
              y = Math.floor(Math.random() * MAP_SIZE);
              if (!initialStructures.some(s => s.x === x && s.y === y)) break;
          }
          if (x !== undefined && y !== undefined) {
              const isNatural = type === 'TREE' || type === 'BERRY_BUSH';
              initialStructures.push({
                  id: `${type.toLowerCase()}-${i}`,
                  type: type,
                  x,
                  y,
                  inventory: [],
                  growth: isNatural ? 100 : undefined // Start map gen items fully grown
              });
          }
        }
    };

    spawnRandom('TREE', 15);
    spawnRandom('BERRY_BUSH', 10);
    spawnRandom('BOULDER', 8);
    spawnRandom('STEEL_VEIN', 5);
    spawnRandom('SILVER_VEIN', 2);
    spawnRandom('GOLD_VEIN', 1);
    spawnRandom('URANIUM_VEIN', 1);

    return initialStructures;
};

export const findBatchTargets = (startStruct: Structure, activityId: string, structures: Structure[]): Structure[] => {
    const batch: Structure[] = [];
    const queue: Structure[] = [startStruct];
    const visited = new Set<string>();
    visited.add(startStruct.id);

    while(queue.length > 0) {
        const current = queue.shift()!;
        batch.push(current);
        
        // Max batch size to prevent lag/overflow
        if (batch.length > 20) break; 

        // Check 4 neighbors
        const dirs = [[0,1], [0,-1], [1,0], [-1,0]];
        for (const [dx, dy] of dirs) {
            const nx = current.x + dx;
            const ny = current.y + dy;
            
            const neighbor = structures.find(s => s.x === nx && s.y === ny);
            if (neighbor && !visited.has(neighbor.id)) {
                let isValid = false;
                
                // Criteria based on activity
                if (activityId === CONSTRUCT_ACTIVITY_ID) {
                    // Construct: Must be blueprint of same type
                    if (neighbor.isBlueprint && neighbor.type === startStruct.type) isValid = true;
                } else if (activityId === HARVEST_ACTIVITY_ID) {
                    // Harvest Farm Plot
                    if (neighbor.type === 'FARM_PLOT' && neighbor.crop && neighbor.crop.growth >= 100) isValid = true;
                } else if (activityId.startsWith('plant_')) {
                    // Plant: Must be Farm Plot with NO crop
                    if (neighbor.type === 'FARM_PLOT' && (!neighbor.crop || !neighbor.crop.planted)) isValid = true;
                } else if (activityId === 'chop_wood' && neighbor.type === 'TREE') {
                    // Batch Chop (Any growth)
                    isValid = true;
                } else if (activityId === 'harvest_berry' && neighbor.type === 'BERRY_BUSH') {
                    // Batch Berry (>= 80%)
                    if (neighbor.growth === undefined || neighbor.growth >= 80) isValid = true;
                }

                if (isValid) {
                    visited.add(neighbor.id);
                    queue.push(neighbor);
                }
            }
        }
    }
    
    // Sort by distance to startStruct for simpler pathing
    return batch.sort((a,b) => {
        const distA = Math.abs(a.x - startStruct.x) + Math.abs(a.y - startStruct.y);
        const distB = Math.abs(b.x - startStruct.x) + Math.abs(b.y - startStruct.y);
        return distA - distB;
    });
};