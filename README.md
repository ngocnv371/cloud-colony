
# Colony Sim MVP Logic Documentation

## Needs System

Each pawn has a `needs` object tracking basic survival requirements (0-100).

### 1. Need Types
- **Food**: Hunger level.
- **Sleep**: Rest level.
- **Recreation**: Boredom/Fun level.

### 2. Decay Rates
Needs decay every tick (250ms).
- **Food**: -0.416/tick (0 to 100 takes ~60 seconds)
- **Sleep**: -0.138/tick (0 to 100 takes ~180 seconds)
- **Recreation**: -0.138/tick (0 to 100 takes ~180 seconds)

### 3. Critical Thresholds & Behavior
When a need drops below a critical threshold, the pawn's AI interrupts their current queue to solve the problem immediately.

*Priority Order: Sleep > Food > Recreation*

#### Sleep (Critical < 10)
- **Action**: Pawn drops whatever they are doing.
- **Job**: `SLEEP`.
- **Location**: Current location (Floor sleeping).
- **Recovery**: +0.5/tick (approx 2 per second). Wakes up at 100.

#### Food (Critical < 15)
- **Action**: Pawn searches for food.
- **Source Priority**: Inventory > Storage Chests > Bushes.
- **Job**: `WITHDRAW` (move to food) -> `EAT`.
- **Recovery**: Consuming a meal or raw food (berries) instantly grants +100 food (capped at 100).
- **Failure**: If no food is found, logs an error and pawn remains hungry.

#### Recreation (Critical < 20)
- **Action**: Pawn looks for an unoccupied recreation structure (e.g., Chess Table, Tree, Cloud Watching spot).
- **Job**: `WORK` (with specific recreation activity ID).
- **Recovery**: +0.5/tick while performing the activity.

### 4. Items & Nutrition
- **Simple Meal**: 100 Nutrition
- **Fine Meal**: 100 Nutrition
- **Berries**: 20 Nutrition
- **Corn**: 15 Nutrition
- **Potato**: 10 Nutrition
- **Rice**: 5 Nutrition

### 5. Idle Behavior
If a pawn is idle (no job, empty queue), they have a small chance to perform Recreation activities voluntarily if their Recreation need is < 80%.
