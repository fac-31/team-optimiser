import type { Person, ConflictMatrix, TeamAssignment, OptimizationResult } from './types.js';

/**
 * Calculate conflict score for a team assignment
 * Score is the sum of all pairwise conflicts within teams
 */
function calculateConflictScore(
  teams: Person[][],
  conflictMatrix: ConflictMatrix
): number {
  let totalScore = 0;

  for (const team of teams) {
    // For each team, calculate pairwise conflicts
    for (let i = 0; i < team.length; i++) {
      for (let j = i + 1; j < team.length; j++) {
        const person1 = team[i].id;
        const person2 = team[j].id;

        // Get conflict score (default to 0 if not found)
        const conflict = conflictMatrix[person1]?.[person2] ?? 0;
        totalScore += conflict;
      }
    }
  }

  return totalScore;
}

/**
 * Generate all possible combinations of k items from array
 */
function* combinations<T>(array: T[], k: number): Generator<T[]> {
  if (k === 0) {
    yield [];
    return;
  }

  if (k > array.length) {
    return;
  }

  for (let i = 0; i <= array.length - k; i++) {
    const first = array[i];
    const rest = array.slice(i + 1);

    for (const combo of combinations(rest, k - 1)) {
      yield [first, ...combo];
    }
  }
}

/**
 * Generate all possible team partitions with symmetry breaking
 *
 * Symmetry breaking optimization:
 * When multiple teams have the same size, we enforce canonical ordering
 * by requiring that the minimum ID in each team is in ascending order.
 * This eliminates duplicate partitions that differ only by team permutation.
 *
 * Example: For teams [3,3,3,3], instead of generating both:
 *   [{A,B,C}, {D,E,F}, {G,H,I}, {J,K,L}] and
 *   [{D,E,F}, {A,B,C}, {G,H,I}, {J,K,L}]
 * We only generate the first one (where min IDs are: A < D < G < J)
 *
 * This reduces combinations by a factor of k! for k teams of the same size.
 */
function* generatePartitions(
  people: Person[],
  teamSizes: number[],
  lastMinId: string | null = null
): Generator<Person[][]> {
  if (teamSizes.length === 0) {
    yield [];
    return;
  }

  const [firstTeamSize, ...remainingTeamSizes] = teamSizes;

  // Check if next team has same size (for symmetry breaking)
  const nextTeamHasSameSize = remainingTeamSizes.length > 0 &&
                               remainingTeamSizes[0] === firstTeamSize;

  // Generate all combinations for the first team
  for (const firstTeam of combinations(people, firstTeamSize)) {
    // Symmetry breaking: If this team size matches the next team size,
    // ensure the minimum ID in this team is less than the minimum ID
    // of the next team to avoid generating duplicate partitions
    const minIdInTeam = firstTeam.reduce((min, person) =>
      person.id < min ? person.id : min, firstTeam[0].id
    );

    // If we have a constraint from the previous team, check it
    if (lastMinId !== null && minIdInTeam <= lastMinId) {
      continue; // Skip this combination to maintain canonical ordering
    }

    // Get remaining people
    const remaining = people.filter(p => !firstTeam.includes(p));

    // Recursively partition the remaining people
    // Pass the minimum ID constraint only if the next team has the same size
    const nextMinId = nextTeamHasSameSize ? minIdInTeam : null;
    for (const restOfTeams of generatePartitions(remaining, remainingTeamSizes, nextMinId)) {
      yield [firstTeam, ...restOfTeams];
    }
  }
}

/**
 * Main optimization function using exhaustive search
 */
export function optimizeTeams(
  people: Person[],
  teamSizes: number[],
  conflictMatrix: ConflictMatrix,
  maxResults: number = 10
): OptimizationResult {
  const startTime = Date.now();

  // Validate input
  const totalPeopleNeeded = teamSizes.reduce((sum, size) => sum + size, 0);
  if (totalPeopleNeeded !== people.length) {
    throw new Error(
      `Team sizes sum (${totalPeopleNeeded}) doesn't match number of people (${people.length})`
    );
  }

  let bestAssignments: TeamAssignment[] = [];
  let minScore = Infinity;
  let combinationsChecked = 0;

  // Generate and evaluate all possible partitions
  for (const partition of generatePartitions(people, teamSizes)) {
    combinationsChecked++;

    const score = calculateConflictScore(partition, conflictMatrix);

    if (score < minScore) {
      // Found a better solution
      minScore = score;
      bestAssignments = [{
        teams: partition.map(members => ({ members })),
        conflictScore: score
      }];
    } else if (score === minScore && bestAssignments.length < maxResults) {
      // Found an equally good solution
      bestAssignments.push({
        teams: partition.map(members => ({ members })),
        conflictScore: score
      });
    }

    // Optional: Log progress every 10000 combinations
    if (combinationsChecked % 10000 === 0) {
      console.log(`Checked ${combinationsChecked} combinations, best score: ${minScore}`);
    }
  }

  const executionTimeMs = Date.now() - startTime;

  console.log(`Optimization complete:`);
  console.log(`- Checked ${combinationsChecked} combinations`);
  console.log(`- Best score: ${minScore}`);
  console.log(`- Found ${bestAssignments.length} optimal solutions`);
  console.log(`- Execution time: ${executionTimeMs}ms`);

  return {
    bestAssignments: bestAssignments.slice(0, maxResults),
    totalCombinationsChecked: combinationsChecked,
    executionTimeMs
  };
}
