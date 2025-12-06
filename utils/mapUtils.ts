
import { Structure, TerrainType } from '../types';
import { CONSTRUCT_ACTIVITY_ID, HARVEST_ACTIVITY_ID, MAP_SIZE, STRUCTURES } from '../constants';

export const generateTerrain = (): TerrainType[] => {
    const terrain = new Array(MAP_SIZE * MAP_SIZE).fill(TerrainType.SOIL);

    // Simple noise generation for terrain features
    const seed = Math.random();
    const noise = (nx: number, ny: number) => {
        return Math.sin(nx * 0.1 + seed * 10) * Math.cos(ny * 0.1 + seed * 20);
    };

    for (let y = 0; y < MAP_SIZE; y++) {
        for (let x = 0; x < MAP_SIZE; x++) {
            const val = noise(x, y);
            const idx = y * MAP_SIZE + x;
            
            if (val > 0.6) {
                terrain[idx] = TerrainType.STONE;
            } else if (val < -0.7) {
                terrain[idx] = TerrainType.WATER_DEEP;
            } else if (val < -0.5) {
                terrain[idx] = TerrainType.WATER_SHALLOW;
            } else if (val < -0.3) {
                terrain[idx] = TerrainType.MARSH;
            }
        }
    }
    
    // Add a "Lava Lake" somewhere
    const lavaX = Math.floor(Math.random() * (MAP_SIZE - 4));
    const lavaY = Math.floor(Math.random() * (MAP_SIZE - 4));
    for (let dy = 0; dy < 3; dy++) {
        for (let dx = 0; dx < 3; dx++) {
            if (Math.random() > 0.2) {
                terrain[(lavaY + dy) * MAP_SIZE + (lavaX + dx)] = TerrainType.LAVA;
            }
        }
    }

    // Ensure Landing Zone (10,10 to 15,15) is solid SOIL
    for (let y = 10; y <= 15; y++) {
        for (let x = 10; x <= 15; x++) {
            const idx = y * MAP_SIZE + x;
            terrain[idx] = TerrainType.SOIL;
        }
    }

    return terrain;
};

export const generateInitialStructures = (terrain: TerrainType[]): Structure[] => {
    const initialStructures: Structure[] = [];
    
    const isWater = (x: number, y: number) => {
        const t = terrain[y * MAP_SIZE + x];
        return t === TerrainType.WATER_DEEP || t === TerrainType.WATER_SHALLOW || t === TerrainType.LAVA;
    };

    const spawnRandom = (type: string, count: number) => {
        for(let i=0; i<count; i++) {
          let x = -1, y = -1;
          let valid = false;
          
          // Simple overlap check limit
          for(let attempt=0; attempt<50; attempt++) {
              x = Math.floor(Math.random() * MAP_SIZE);
              y = Math.floor(Math.random() * MAP_SIZE);
              
              const occupied = initialStructures.some(s => s.x === x && s.y === y);
              
              // Protect landing zone (10,10 to 15,15) from spawning obstacles
              const inLandingZone = x >= 10 && x <= 15 && y >= 10 && y <= 15;
              
              if (!occupied && !isWater(x, y) && !inLandingZone) {
                  valid = true;
                  break;
              }
          }
          
          if (valid) {
              const isNatural = type === 'TREE' || type === 'BERRY_BUSH';
              initialStructures.push({
                  id: `${type.toLowerCase()}-${i}`,
                  type: type,
                  x,
                  y,
                  inventory: [],
                  growth: isNatural ? 100 : undefined 
              });
          }
        }
    };

    spawnRandom('TREE', 20);
    spawnRandom('BERRY_BUSH', 12);
    spawnRandom('BOULDER', 10);
    spawnRandom('STEEL_VEIN', 5);
    spawnRandom('SILVER_VEIN', 2);
    spawnRandom('GOLD_VEIN', 1);
    spawnRandom('URANIUM_VEIN', 1);

    return initialStructures;
};

// --- Pathfinding ---

export const isPassable = (x: number, y: number, structures: Structure[], terrain: TerrainType[]): boolean => {
    // Only check map boundaries
    if (x < 0 || x >= MAP_SIZE || y < 0 || y >= MAP_SIZE) return false;

    // Disabled structure/terrain checks for debugging movement as requested
    // Real logic would be:
    // const t = terrain[y * MAP_SIZE + x];
    // if (t === TerrainType.WATER_DEEP || t === TerrainType.LAVA) return false;
    // const s = structures.find(st => st.x === x && st.y === y && !STRUCTURES[st.type].passable);
    // if (s) return false;
    
    return true; 
};

interface Point { x: number, y: number }

export const findPath = (start: Point, end: Point, structures: Structure[], terrain: TerrainType[]): Point[] | null => {
    // Robust A* implementation
    const openSet: Point[] = [start];
    const cameFrom = new Map<string, Point>();
    
    const gScore = new Map<string, number>();
    const fScore = new Map<string, number>();
    const closedSet = new Set<string>();

    const getKey = (p: Point) => `${p.x},${p.y}`;
    
    gScore.set(getKey(start), 0);
    fScore.set(getKey(start), Math.abs(start.x - end.x) + Math.abs(start.y - end.y));

    while (openSet.length > 0) {
        // Find node with lowest fScore
        let current = openSet[0];
        let lowestF = fScore.get(getKey(current)) || Infinity;
        let currentIndex = 0;

        for (let i = 1; i < openSet.length; i++) {
             const f = fScore.get(getKey(openSet[i])) || Infinity;
             if (f < lowestF) {
                 lowestF = f;
                 current = openSet[i];
                 currentIndex = i;
             }
        }

        if (current.x === end.x && current.y === end.y) {
            // Reconstruct path
            const path = [current];
            let currKey = getKey(current);
            while (cameFrom.has(currKey)) {
                current = cameFrom.get(currKey)!;
                path.unshift(current);
                currKey = getKey(current);
            }
            return path;
        }

        // Move current from open to closed
        openSet.splice(currentIndex, 1);
        closedSet.add(getKey(current));

        const neighbors = [
            { x: current.x + 1, y: current.y },
            { x: current.x - 1, y: current.y },
            { x: current.x, y: current.y + 1 },
            { x: current.x, y: current.y - 1 }
        ];

        for (const neighbor of neighbors) {
            const nKey = getKey(neighbor);
            if (closedSet.has(nKey)) continue;

            if (!isPassable(neighbor.x, neighbor.y, structures, terrain)) continue;

            const tentativeG = (gScore.get(getKey(current)) || Infinity) + 1;

            // If neighbor not in openSet, add it
            if (!openSet.some(n => n.x === neighbor.x && n.y === neighbor.y)) {
                openSet.push(neighbor);
            } else if (tentativeG >= (gScore.get(nKey) || Infinity)) {
                continue; // This is not a better path
            }

            // This path is the best until now. Record it!
            cameFrom.set(nKey, current);
            gScore.set(nKey, tentativeG);
            fScore.set(nKey, tentativeG + Math.abs(neighbor.x - end.x) + Math.abs(neighbor.y - end.y));
        }
    }

    return null;
};


// --- Batching Utils ---

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
            
            // Note: In layered map, there might be multiple structures at x,y. 
            // Batch usually applies to same-type.
            
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
                    isValid = true;
                } else if (activityId === 'harvest_berry' && neighbor.type === 'BERRY_BUSH') {
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
