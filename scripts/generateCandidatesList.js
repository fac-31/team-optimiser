/**
 * Generate a candidates list from team history data
 * Creates an editable JSON file with all past contributors
 */

const fs = require('fs');
const path = require('path');

// Read the team history data
const teamDataPath = path.join(__dirname, 'fac31-team-data.json');
const teamData = JSON.parse(fs.readFileSync(teamDataPath, 'utf8'));

// Extract people list and filter out bots
const candidates = teamData.people
  .filter(person => !person.name.includes('[bot]'))
  .map(person => ({
    id: person.id,
    name: person.name,
    available: true,  // User can set this to false for people who left
    notes: ""         // Optional notes field
  }));

// Generate suggested team sizes for available candidates
const totalCandidates = candidates.length;
const suggestedTeamSizes = [];

if (totalCandidates % 4 === 0) {
  const numTeams = totalCandidates / 4;
  suggestedTeamSizes.push(Array(numTeams).fill(4));
}

if (totalCandidates % 3 === 0) {
  const numTeams = totalCandidates / 3;
  suggestedTeamSizes.push(Array(numTeams).fill(3));
}

// Mixed teams
if (totalCandidates >= 7) {
  const numTeamsOf4 = Math.floor(totalCandidates / 4);
  const remainder = totalCandidates % 4;

  if (remainder === 1 && numTeamsOf4 >= 2) {
    suggestedTeamSizes.push([5, ...Array(numTeamsOf4 - 1).fill(4)]);
  } else if (remainder === 2) {
    if (numTeamsOf4 >= 1) {
      suggestedTeamSizes.push([3, 3, ...Array(numTeamsOf4 - 1).fill(4)]);
    }
  } else if (remainder === 3) {
    suggestedTeamSizes.push([3, ...Array(numTeamsOf4).fill(4)]);
  }
}

const candidatesList = {
  candidates,
  suggestedTeamSizes,
  instructions: [
    "1. Review the 'candidates' list below",
    "2. Set 'available: false' for anyone who has left or won't participate",
    "3. Add any notes if needed",
    "4. Use this file to update who should be included in the next team optimization"
  ],
  metadata: {
    totalCandidates: candidates.length,
    generatedAt: new Date().toISOString(),
    source: "fac31-team-data.json"
  }
};

// Write to file
const outputPath = path.join(__dirname, 'candidates.json');
fs.writeFileSync(outputPath, JSON.stringify(candidatesList, null, 2));

console.log(`✓ Candidates list generated: ${outputPath}`);
console.log(`\nTotal candidates: ${candidates.length}`);
console.log(`Suggested team sizes: ${suggestedTeamSizes.map(s => `[${s}]`).join(', ')}`);
console.log(`\nCandidate names:`);
candidates.forEach((c, i) => {
  console.log(`  ${i + 1}. ${c.name}`);
});
console.log(`\n✎ Edit candidates.json to mark who is available for the next teams.`);
