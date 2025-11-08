export interface Person {
  id: string;
  name: string;
}

export interface ConflictMatrix {
  [personId: string]: {
    [personId: string]: number; // Number of times worked together
  };
}

export interface Team {
  members: Person[];
}

export interface TeamAssignment {
  teams: Team[];
  conflictScore: number;
}

export interface OptimizationResult {
  bestAssignments: TeamAssignment[];
  totalCombinationsChecked: number;
  executionTimeMs: number;
}
