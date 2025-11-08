# Team Optimization - Planning Document

## Problem Statement

When forming new teams, minimize the overlap of people who have worked together in past team compositions. This helps ensure fresh collaborations and diverse team dynamics.

## Mathematical Formulation

### Input
- **People**: Set of N individuals
- **Team Sizes**: Array of desired team sizes (e.g., [3, 3, 3, 3] for 4 teams of 3)
- **Conflict Matrix**: Pairwise matrix where `conflict[i][j]` represents how many times person i and person j have worked together

### Objective
Minimize the **total conflict score** where:
```
Total Conflict Score = Σ (all pairwise conflicts within each team)
```

### Constraints
- Each person must be assigned to exactly one team
- Sum of team sizes must equal total number of people
- Teams must match the specified sizes

## Solution Approach: Exhaustive Search

### Why Exhaustive Search?
For small to medium group sizes (≤20 people), exhaustive search is:
- **Guaranteed Optimal**: Finds the absolute best solution
- **Computationally Feasible**: Modern hardware can check hundreds of thousands of combinations in seconds
- **Simple to Implement**: No complex heuristics needed

### Complexity Analysis
For 12 people split into 4 teams of 3:
- Naive combinations: ~369,600
- **With symmetry breaking**: ~15,400 (24x reduction from 4! = 24)
- Expected runtime: < 1 second on modern hardware

For 15 people split into teams of [4, 4, 4, 3]:
- Naive combinations: ~750M
- **With symmetry breaking**: ~125M (6x reduction from 3! = 6)
- Expected runtime: 1-5 minutes (down from 5-30 minutes)

### Algorithm Steps

1. **Generate All Partitions**
   - Use recursive combination generation
   - For team sizes [t1, t2, ..., tn]:
     - Choose t1 people for first team (C(N, t1) ways)
     - Choose t2 people from remaining for second team
     - Continue recursively

2. **Score Each Partition**
   - For each team in the partition:
     - Sum all pairwise conflicts between team members
   - Total score = sum across all teams

3. **Track Best Solutions**
   - Maintain minimum score found
   - Store multiple equally-good solutions
   - Early pruning possible (future optimization)

## Architecture

### Monorepo Structure
```
team-optimiser/
├── backend/          # TypeScript/Express API
│   └── src/
│       ├── index.ts           # Express server
│       ├── teamOptimizer.ts   # Core algorithm
│       └── types.ts           # Shared types
└── frontend/         # SvelteKit UI
    └── src/
        ├── routes/
        │   ├── +layout.svelte         # Navigation layout with tabs
        │   ├── +page.svelte           # Collaboration history (home)
        │   └── optimize/
        │       └── +page.svelte       # Team optimization screen
        └── lib/
            └── stores/
                └── historyStore.ts    # Persistent graph state
```

### Backend API

**POST /api/optimize**
- **Input**:
  ```json
  {
    "people": [{ "id": "1", "name": "Alice" }, ...],
    "teamSizes": [3, 3, 3, 3],
    "conflictMatrix": {
      "1": { "2": 2, "3": 1 },
      "2": { "1": 2, "4": 2 }
    }
  }
  ```
- **Output**:
  ```json
  {
    "bestAssignments": [{
      "teams": [{ "members": [...] }, ...],
      "conflictScore": 15
    }],
    "totalCombinationsChecked": 369600,
    "executionTimeMs": 1234
  }
  ```

**GET /api/health**
- Health check endpoint

### Core Algorithm Implementation

#### 1. Combination Generator
```typescript
function* combinations<T>(array: T[], k: number): Generator<T[]>
```
Generates all ways to choose k items from array using recursion.

#### 2. Partition Generator
```typescript
function* generatePartitions(people: Person[], teamSizes: number[], lastMinId?: string): Generator<Person[][]>
```
Recursively generates all valid team partitions with **symmetry breaking**:
- Pick first team using combinations
- **Symmetry breaking optimization**: When consecutive teams have the same size, enforce canonical ordering by requiring minimum IDs to be in ascending order
- This eliminates duplicate partitions (e.g., `[{A,B}, {C,D}]` vs `[{C,D}, {A,B}]`)
- Recursively partition remaining people
- Yield complete partitions

**Performance impact**: For k teams of the same size, reduces combinations by factor of k!
- Example: 4 teams of size 3 → 24x speedup (4! = 24)
- Example: 3 teams of size 4 → 6x speedup (3! = 6)

#### 3. Conflict Score Calculator
```typescript
function calculateConflictScore(teams: Person[][], conflictMatrix: ConflictMatrix): number
```
Sums all pairwise conflicts within each team.

#### 4. Main Optimizer
```typescript
function optimizeTeams(people, teamSizes, conflictMatrix, maxResults): OptimizationResult
```
- Validates input
- Generates and scores all partitions
- Tracks best solutions
- Returns top results with metadata

### Frontend Features

#### Navigation
- **Two-screen interface** with tab navigation
- Persistent layout across routes
- Active tab highlighting using SvelteKit `$page` store
- SvelteKit client-side routing

#### Screen 1: Collaboration History (Home) ✓ (Implemented)
- **File Upload**:
  - Upload JSON files with team history data
  - Example template available at [`frontend/static/fac31-team-data.json`](frontend/static/fac31-team-data.json)
  - Example contains real FAC-31 data harvested from GitHub repositories on 8 November 2025
  - Validates JSON format
  - FileReader API for client-side processing

- **Interactive Force-Directed Graph**:
  - SVG-based rendering for scalability
  - Force-directed layout algorithm with configurable physics
  - Nodes represent contributors
  - Edges represent collaborations

![Collaboration History Graph](../screenshots/HistoricData.png)
*Interactive force-directed graph visualization with drag-and-drop, zoom, and pan controls*

- **Visual Encoding**:
  - Node size: Proportional to total collaborations (8-20px radius)
  - Edge thickness: Collaboration frequency (1-10px)
  - Edge opacity: Collaboration frequency (30-100%)
  - Edge labels: Exact collaboration counts
  - Node labels: Contributor names with stroke outline

- **Interactivity**:
  - **Drag & Drop**: Click and drag individual nodes to reposition
  - **Zoom**: Mouse wheel to zoom 0.1x to 5x
  - **Pan**: Click and drag background to move viewport
  - **Toggle Labels**: Show/hide contributor names
  - **Reset View**: Return to default zoom/pan
  - **Regenerate Layout**: Re-run force-directed algorithm with new random positions

- **State Persistence**:
  - Svelte writable store (`historyStore.ts`) maintains graph data
  - Graph persists when navigating between tabs
  - Node positions preserved during tab switches

- **Implementation Details**:
  - Custom force simulation (repulsion + attraction)
  - ViewBox-based coordinate system for zoom/pan
  - Event handlers: `onmousedown`, `onmousemove`, `onmouseup`, `onwheel`
  - Reactive state management with Svelte 5 `$state` runes
  - Persistent store for cross-navigation state
  - Accessibility: ARIA roles and keyboard support

#### Screen 2: Team Optimization ✓ (Implemented)
- **Data Integration**:
  - Reads from Collaboration History store (no static data)
  - Requires team history uploaded on Screen 1
  - Shows warning if no history data available

- **Candidate Selection**:
  - All team members selected by default
  - Interactive checkboxes for individual selection
  - "Select All" / "Deselect All" bulk actions
  - Real-time count of selected candidates
  - Visual feedback (color, weight) for selection state

- **Team Size Configuration**:
  - Input field for desired team size (minimum 2)
  - Automatic calculation of team distribution
  - Preview of resulting team sizes (e.g., [4, 4, 4, 3])
  - Handles remainders by creating smaller final team

- **Optimization Process**:
  - Filters only selected candidates
  - Calculates team sizes based on configuration
  - Sends data to backend API (`/api/optimize`)
  - Loading state during computation
  - Error handling with clear messages

- **Results Display**:
  - Best conflict score (minimum found)
  - Number of combinations checked
  - Execution time in milliseconds
  - Multiple optimal solutions (up to 10)
  - Detailed conflict breakdown per team
  - Pairwise conflicts displayed for each team member pair

- **State Management**:
  - Uses `onMount()` to subscribe to history store (client-side only)
  - Avoids SSR hydration issues
  - Reactive updates when history data changes
  - Results persist across tab navigation

![Optimization Results](../screenshots/Results.png)
*Team optimization results showing optimal assignments with conflict scores and performance metrics*

## Technical Implementation Notes

### SSR Hydration Fix

**Problem**: The application initially suffered from recurring `__SVELTEKIT_PAYLOAD__` errors caused by SSR/client hydration mismatches.

**Root Cause**:
- Both pages accessed `$historyStore` during variable initialization
- Server-side rendering executed with initial empty state
- Client hydration executed with potentially different store values
- SvelteKit detected mismatch between server HTML and client state

**Solution**:
1. **Modified store initialization**: Initialize all state variables with empty/default values
2. **Used `onMount()` lifecycle**: Load data from store only after component mounts (client-side only)
3. **Proper subscription pattern**: Subscribe to store within `onMount()` and return cleanup function
4. **Consistent initial render**: Both server and client render the same initial HTML

**Files Changed**:
- [`frontend/src/routes/+page.svelte`](frontend/src/routes/+page.svelte): History screen
- [`frontend/src/routes/optimize/+page.svelte`](frontend/src/routes/optimize/+page.svelte): Optimize screen
- [`frontend/src/lib/stores/historyStore.ts`](frontend/src/lib/stores/historyStore.ts): Store implementation

**Result**:
- ✅ No hydration mismatches
- ✅ Graph persists across tab navigation
- ✅ Store state maintained throughout session
- ✅ No more `__SVELTEKIT_PAYLOAD__` errors

## Graph Visualization Algorithm

### Force-Directed Layout

The collaboration history graph uses a custom force-directed layout algorithm to position nodes:

#### Forces Applied

1. **Repulsion Force** (node-to-node):
   ```
   F_repulsion = REPULSION / distance²
   REPULSION = 20000  // Tuned for better spreading
   ```
   - All nodes repel each other
   - Inverse square law prevents overlap
   - Spreads nodes across canvas

2. **Attraction Force** (along edges):
   ```
   F_attraction = ATTRACTION × distance × ln(weight + 1)
   ATTRACTION = 0.005  // Tuned to reduce clustering
   ```
   - Edges pull connected nodes together
   - Strength logarithmic with collaboration count
   - Frequent collaborators cluster together

3. **Damping** (velocity decay):
   ```
   velocity *= DAMPING
   DAMPING = 0.6  // More aggressive damping for stability
   ```
   - Simulates friction
   - Stabilizes layout over time
   - Prevents endless oscillation

#### Simulation Process

1. Initialize nodes with random positions within margin bounds (150px from edges)
2. For 500 iterations:
   - Calculate repulsion between all node pairs
   - Calculate attraction along all edges
   - Update velocities based on forces
   - Update positions based on velocities
   - Apply damping to velocities
   - Clamp positions to canvas bounds (100px margin)
3. Render final layout

#### Interactive Physics

After initial layout, users can:
- **Drag nodes**: Manually override positions, zero velocity
- **Zoom/Pan**: Modify viewport without affecting node positions
- **Regenerate**: Reset to random positions and re-run simulation

### Coordinate Systems

- **World coordinates**: 1200 × 800 canvas (node positions)
- **View coordinates**: Dynamic viewBox for zoom/pan
- **Screen coordinates**: Mouse events converted to world coordinates

```typescript
worldX = viewBox.x + (mouseX / screenWidth) * viewBox.width
worldY = viewBox.y + (mouseY / screenHeight) * viewBox.height
```

## Future Optimizations

### 1. Branch & Bound Pruning
- Track best score found so far
- Calculate partial scores during generation
- Abandon branches that already exceed best score
- Can reduce search space by 50-90%

### 2. Symmetry Breaking ✅ (Implemented)
- **Status**: Implemented for teams with identical sizes
- Eliminates equivalent solutions where team order doesn't matter
- Enforces canonical ordering by requiring minimum person ID in each team to be ascending
- Reduces combinations by factor of k! for k teams of the same size
- **Impact**: 6-24x speedup for typical scenarios with 3-4 teams of same size

### 3. Parallel Processing
- Partition search space across workers
- Utilize multiple CPU cores
- Near-linear speedup for larger problems

### 4. Caching & Memoization
- Cache partial conflict scores
- Store frequently-accessed conflict values
- Useful for repeated optimizations with similar data

### 5. Progressive Results
- Stream results as they're found
- Allow user to stop early if acceptable solution found
- Provide real-time progress updates

### 6. Heuristic Approaches (for larger N)
For groups > 20 people:
- **Simulated Annealing**: Start with random assignment, iteratively improve
- **Genetic Algorithms**: Evolve population of solutions
- **Greedy + Local Search**: Fast initial solution, then optimize locally

## Performance Expectations

**With symmetry breaking optimization:**

| People | Teams | Naive Combinations | Optimized Combinations | Est. Time |
|--------|-------|--------------------|------------------------|-----------|
| 9      | 3×3   | ~280               | ~47 (6x)               | < 1ms     |
| 12     | 4×3   | ~370K              | ~15K (24x)             | < 1s      |
| 15     | 5×3   | ~750M              | ~6.25M (120x)          | 10-60s    |
| 16     | 4×4   | ~63M               | ~2.6M (24x)            | 5-30s     |
| 15     | [4,4,4,3] | ~750M          | ~125M (6x)             | 1-5min    |
| 20     | 5×4   | ~10B               | ~83M (120x)            | 1-10min*  |

*With symmetry breaking, problems up to 20 people become feasible with exhaustive search.
Beyond 20-25 people, heuristic methods may still be beneficial for faster results.

## Data Collection & Preparation

### GitHub Team History Fetcher

The `scripts/fetchTeamHistory.js` tool automatically:
1. Fetches contributors from specified GitHub repositories
2. Builds a conflict matrix tracking all pairwise collaborations
3. Generates people list with unique IDs
4. Suggests optimal team sizes based on total participants
5. Preserves complete team history for reference

**Usage:**
```bash
cd scripts
node fetchTeamHistory.js
```

**Output:**
- `fac31-team-data.json` - Complete historical data
- Conflict matrix with collaboration frequencies
- Suggested team configurations
- Metadata (timestamps, totals)

### Candidate List Management

The `scripts/generateCandidatesList.js` tool:
1. Extracts human contributors (filters out bots)
2. Creates editable JSON with availability flags
3. Suggests team sizes for current candidate pool
4. Provides instructions for manual editing

**Workflow:**
1. Generate initial candidates list
2. Manually update `available: false` for departed members
3. Optionally add notes per candidate
4. Use filtered list for optimization

## Testing Strategy

1. **Unit Tests**
   - Combination generator correctness
   - Conflict score calculation
   - Edge cases (empty teams, single person, etc.)

2. **Integration Tests**
   - API endpoint validation
   - Error handling
   - Large input handling

3. **Performance Tests**
   - Benchmark different group sizes
   - Verify complexity predictions
   - Stress test with maximum inputs

4. **Validation Tests**
   - Verify all people assigned exactly once
   - Confirm team sizes match specification
   - Check score calculation accuracy

5. **Real Data Tests**
   - Validate FAC-31 data integrity
   - Ensure conflict matrix symmetry
   - Verify team history accuracy against GitHub

## Example Scenarios

### Scenario 1: FAC-31 Real Data
- **15 contributors** from Founders and Coders Cohort 31
- **24 past team compositions** from GitHub repositories
- Historical collaboration data spanning multiple projects
- **Use case**: Form new project teams minimizing past overlap
- **Data locations**:
  - `scripts/fac31-team-data.json` - Generated by fetch script
  - `frontend/static/fac31-team-data.json` - Example template (harvested 8 November 2025)
- **Top conflicts**:
  - chrislush & nchua3012: 6 collaborations
  - arecouz & Jaz-spec: 5 collaborations
  - Multiple pairs with 4 collaborations
- **Suggested configurations**: [5,4,4,4] or [3,3,3,3,3]

### Scenario 2: Workshop Team Formation
- 12 participants
- 4 teams of 3
- Historical data from 3 previous workshops
- Goal: Maximize fresh pairings

### Scenario 3: Project Team Rotation
- 16 developers
- 4 teams of 4
- Conflict matrix from past 6 months
- Goal: Spread institutional knowledge

### Scenario 4: Training Groups
- 9 trainees
- 3 teams of 3
- New cohort (minimal conflicts)
- Goal: Balanced skill distribution (extend with skill weights)

## Extension Possibilities

### Implemented ✓
6. **Historical Tracking**: Build conflict matrix from team history (implemented in `scripts/`)
8. **Visualization**: Graph view of conflict network (implemented with interactive force-directed graph)
9. **GitHub Integration**: Automated data fetching from organization repos (implemented)
10. **Candidate Management**: Filter available/unavailable participants (implemented)

### Future Enhancements
1. **Weighted Conflicts**: Recent collaborations weighted higher
2. **Skill Balancing**: Ensure diverse skills per team
3. **Hard Constraints**: Never pair certain people
4. **Preferred Pairings**: Bonus for specific combinations
5. **Multi-Objective**: Balance conflicts, skills, diversity
7. **Export/Import**: Save and load scenarios
11. **Graph Enhancements**:
    - Save/load custom node positions
    - Export graph as SVG/PNG
    - Filter edges by collaboration threshold
    - Highlight paths between specific people
    - Color coding by collaboration intensity
    - Community detection algorithms
    - Timeline view of collaboration evolution
