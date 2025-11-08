<script lang="ts">
  import { onMount } from 'svelte';
  import { historyStore } from '$lib/stores/historyStore';

  interface Person {
    id: string;
    name: string;
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

  interface Candidate extends Person {
    selected: boolean;
  }

  // Get data from history store
  let candidates = $state<Candidate[]>([]);
  let conflictMatrix = $state<{ [key: string]: { [key: string]: number } }>({});
  let teamSizeInput = $state('3');
  let results = $state<OptimizationResult | null>(null);
  let loading = $state(false);
  let error = $state<string>('');
  let noHistoryData = $state(true);

  // Load data from history store on mount (client-side only)
  onMount(() => {
    const unsubscribe = historyStore.subscribe(storeData => {
      if (storeData.hasData && storeData.people.length > 0) {
        // Initialize candidates with all people selected by default
        candidates = storeData.people.map(person => ({
          ...person,
          selected: true
        }));
        conflictMatrix = storeData.conflictMatrix;
        noHistoryData = false;

        // Load persisted optimization results
        if (storeData.optimizationResults) {
          results = storeData.optimizationResults;
        }
      } else {
        noHistoryData = true;
      }
    });

    return unsubscribe;
  });

  function toggleCandidate(candidateId: string) {
    const candidate = candidates.find(c => c.id === candidateId);
    if (candidate) {
      candidate.selected = !candidate.selected;
    }
  }

  function selectAll() {
    candidates.forEach(c => c.selected = true);
  }

  function deselectAll() {
    candidates.forEach(c => c.selected = false);
  }

  function calculateTeamSizes(totalPeople: number, teamSize: number): number[] {
    const numFullTeams = Math.floor(totalPeople / teamSize);
    const remainder = totalPeople % teamSize;

    const sizes: number[] = [];
    for (let i = 0; i < numFullTeams; i++) {
      sizes.push(teamSize);
    }

    // Distribute remainder among teams
    if (remainder > 0) {
      // Add remainder as a smaller team
      sizes.push(remainder);
    }

    return sizes;
  }

  async function optimizeTeams() {
    loading = true;
    error = '';
    results = null;

    try {
      // Get selected candidates
      const selectedCandidates = candidates.filter(c => c.selected);

      if (selectedCandidates.length === 0) {
        throw new Error('Please select at least one candidate');
      }

      const teamSize = parseInt(teamSizeInput);
      if (isNaN(teamSize) || teamSize < 2) {
        throw new Error('Team size must be at least 2');
      }

      if (selectedCandidates.length < teamSize) {
        throw new Error(`Not enough candidates for team size ${teamSize}. Selected: ${selectedCandidates.length}`);
      }

      // Calculate team sizes
      const teamSizes = calculateTeamSizes(selectedCandidates.length, teamSize);

      const response = await fetch('http://localhost:3001/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          people: selectedCandidates,
          teamSizes,
          conflictMatrix
        })
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.statusText}`);
      }

      results = await response.json();

      // Persist results to store
      historyStore.update(store => ({
        ...store,
        optimizationResults: results
      }));
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred';
      console.error('Optimization error:', err);
    } finally {
      loading = false;
    }
  }

  function getConflictBetween(person1Id: string, person2Id: string): number {
    return conflictMatrix[person1Id]?.[person2Id] ??
           conflictMatrix[person2Id]?.[person1Id] ?? 0;
  }
</script>

<main>
  <h1>Optimize Teams</h1>
  <p>Select candidates and configure team size to find optimal team compositions</p>

  {#if noHistoryData}
    <div class="warning">
      <strong>No team history data loaded.</strong>
      <p>Please upload team history data on the <a href="/">Collaboration History</a> tab first.</p>
    </div>
  {:else}
    <section class="candidates-section">
      <div class="section-header">
        <h2>Select Candidates</h2>
        <div class="bulk-actions">
          <button onclick={selectAll} class="secondary">Select All</button>
          <button onclick={deselectAll} class="secondary">Deselect All</button>
        </div>
      </div>
      <p class="help-text">
        Choose which team members are available for the next team composition.
        Selected: <strong>{candidates.filter(c => c.selected).length}</strong> / {candidates.length}
      </p>
      <div class="candidates-grid">
        {#each candidates as candidate}
          <label class="candidate-item">
            <input
              type="checkbox"
              checked={candidate.selected}
              onchange={() => toggleCandidate(candidate.id)}
            />
            <span class:selected={candidate.selected}>{candidate.name}</span>
          </label>
        {/each}
      </div>
    </section>

    <section class="team-config">
      <h2>Team Configuration</h2>
      <div class="config-row">
        <label for="teamSize">
          <strong>Desired Team Size:</strong>
        </label>
        <input
          id="teamSize"
          type="number"
          min="2"
          max={candidates.length}
          bind:value={teamSizeInput}
          class="team-size-input"
        />
        <span class="help-text">
          {#if parseInt(teamSizeInput) > 0 && candidates.filter(c => c.selected).length > 0}
            {@const selected = candidates.filter(c => c.selected).length}
            {@const teamSize = parseInt(teamSizeInput)}
            {@const teamSizes = calculateTeamSizes(selected, teamSize)}
            Will create teams of size: {teamSizes.join(', ')}
          {/if}
        </span>
      </div>
    </section>

    <section class="controls">
      <button onclick={optimizeTeams} disabled={loading || candidates.filter(c => c.selected).length === 0}>
        {loading ? 'Optimizing...' : 'Optimize Teams'}
      </button>
    </section>

    {#if error}
      <div class="error">
        Error: {error}
      </div>
    {/if}
  {/if}

  {#if results}
    <section class="results">
      <h2>Optimization Results</h2>
      <div class="stats">
        <div>Best Conflict Score: <strong>{results.bestAssignments[0]?.conflictScore}</strong></div>
        <div>Combinations Checked: <strong>{results.totalCombinationsChecked.toLocaleString()}</strong></div>
        <div>Execution Time: <strong>{results.executionTimeMs}ms</strong></div>
        <div>Optimal Solutions Found: <strong>{results.bestAssignments.length}</strong></div>
      </div>

      <h3>Best Team Assignments (showing up to 10)</h3>
      {#each results.bestAssignments as assignment, idx}
        <div class="assignment">
          <h4>Solution {idx + 1} (Score: {assignment.conflictScore})</h4>
          <div class="teams">
            {#each assignment.teams as team, teamIdx}
              <div class="team">
                <h5>Team {teamIdx + 1}</h5>
                <ul>
                  {#each team.members as member}
                    <li>{member.name}</li>
                  {/each}
                </ul>
                <div class="team-conflicts">
                  <strong>Internal conflicts:</strong>
                  {#each team.members as member1, i}
                    {#each team.members.slice(i + 1) as member2}
                      {@const conflict = getConflictBetween(member1.id, member2.id)}
                      {#if conflict > 0}
                        <div class="conflict">
                          {member1.name} ↔ {member2.name}: {conflict}
                        </div>
                      {/if}
                    {/each}
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </section>
  {/if}
</main>

<style>
  main {
    max-width: 1200px;
    margin: 20px auto;
    background: white;
    padding: 30px;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  h1 {
    color: #333;
    margin-top: 0;
  }

  h2 {
    color: #444;
    margin-top: 0;
  }

  p {
    color: #666;
  }

  .warning {
    background: #fff3cd;
    color: #856404;
    padding: 20px;
    border-radius: 4px;
    margin: 20px 0;
    border: 1px solid #ffc107;
  }

  .warning p {
    margin: 10px 0 0 0;
  }

  .warning a {
    color: #0056b3;
    text-decoration: underline;
  }

  .candidates-section {
    margin: 30px 0;
    padding: 25px;
    background: #f8f9fa;
    border-radius: 6px;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
  }

  .bulk-actions {
    display: flex;
    gap: 10px;
  }

  .help-text {
    color: #666;
    font-size: 14px;
    margin: 10px 0;
  }

  .candidates-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
    margin-top: 15px;
  }

  .candidate-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 15px;
    background: white;
    border: 2px solid #e0e0e0;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .candidate-item:hover {
    border-color: #007bff;
    background: #f0f8ff;
  }

  .candidate-item input[type="checkbox"] {
    cursor: pointer;
    width: 18px;
    height: 18px;
  }

  .candidate-item span {
    color: #888;
    transition: color 0.2s;
  }

  .candidate-item span.selected {
    color: #333;
    font-weight: 500;
  }

  .team-config {
    margin: 30px 0;
    padding: 25px;
    background: #f8f9fa;
    border-radius: 6px;
  }

  .config-row {
    display: flex;
    align-items: center;
    gap: 15px;
    flex-wrap: wrap;
  }

  .team-size-input {
    width: 80px;
    padding: 8px 12px;
    font-size: 16px;
    border: 2px solid #ddd;
    border-radius: 4px;
    transition: border-color 0.2s;
  }

  .team-size-input:focus {
    outline: none;
    border-color: #007bff;
  }

  .controls {
    display: flex;
    gap: 10px;
    margin: 20px 0;
  }

  button {
    padding: 12px 24px;
    font-size: 16px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    background: #007bff;
    color: white;
    transition: background 0.2s;
    font-weight: 600;
  }

  button.secondary {
    background: #6c757d;
    padding: 8px 16px;
    font-size: 14px;
    font-weight: normal;
  }

  button.secondary:hover:not(:disabled) {
    background: #545b62;
  }

  button:hover:not(:disabled) {
    background: #0056b3;
  }

  button:disabled {
    background: #ccc;
    cursor: not-allowed;
  }

  .error {
    background: #fee;
    color: #c33;
    padding: 15px;
    border-radius: 4px;
    margin: 20px 0;
    border: 1px solid #fcc;
  }

  .results {
    margin-top: 30px;
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 15px;
    margin: 20px 0;
    padding: 20px;
    background: #f8f9fa;
    border-radius: 4px;
  }

  .stats div {
    font-size: 14px;
    color: #555;
  }

  .assignment {
    margin: 20px 0;
    padding: 20px;
    background: #f9f9f9;
    border-radius: 6px;
    border: 1px solid #ddd;
  }

  .assignment h4 {
    margin-top: 0;
    color: #444;
  }

  .teams {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 15px;
  }

  .team {
    background: white;
    padding: 15px;
    border-radius: 4px;
    border: 1px solid #e0e0e0;
  }

  .team h5 {
    margin: 0 0 10px 0;
    color: #007bff;
  }

  .team ul {
    margin: 0 0 10px 0;
    padding-left: 20px;
  }

  .team li {
    margin: 5px 0;
  }

  .team-conflicts {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid #e0e0e0;
    font-size: 13px;
  }

  .conflict {
    color: #666;
    margin: 3px 0;
    padding: 2px 0;
  }
</style>
