import { writable } from 'svelte/store';
import { browser } from '$app/environment';

interface Person {
  id: string;
  name: string;
}

interface ConflictMatrix {
  [personId: string]: {
    [personId: string]: number;
  };
}

interface Edge {
  source: string;
  target: string;
  weight: number;
}

interface Node {
  id: string;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  totalCollaborations: number;
}

interface TeamAssignment {
  teams: { members: Person[] }[];
  conflictScore: number;
}

interface OptimizationResult {
  bestAssignments: TeamAssignment[];
  totalCombinationsChecked: number;
  executionTimeMs: number;
}

interface HistoryData {
  people: Person[];
  conflictMatrix: ConflictMatrix;
  nodes: Node[];
  edges: Edge[];
  hasData: boolean;
  optimizationResults: OptimizationResult | null;
}

const initialState: HistoryData = {
  people: [],
  conflictMatrix: {},
  nodes: [],
  edges: [],
  hasData: false,
  optimizationResults: null
};

// Create a writable store that only exists in the browser
function createHistoryStore() {
  const { subscribe, set, update } = writable<HistoryData>(initialState);

  return {
    subscribe,
    set,
    update
  };
}

export const historyStore = createHistoryStore();
