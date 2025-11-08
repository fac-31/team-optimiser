/**
 * Fetch team history from fac-31 GitHub organization
 * Builds conflict matrix and example data for team optimizer
 */

const REPOS = [
  'Pro1020-ALAN',
  'commons-traybake',
  'TravelAgencyBE',
  'Pro0929-CLI-Unites',
  'FAC31_Bodybuilders',
  'ReDoT',
  'Pro0217-BookRecommender',
  'Pro0623-StoryMaker',
  'Pro0623-ObsidianTwoPointOPointO',
  'Pro0428-LocalEventBackend',
  'Pro0428-F.L.A.T.BackEnd',
  'Pro0428-MindPalaceBackend',
  'Pro0217-UserGeneration',
  'Pro0217-MyTarotation',
  'Wor0206-VanA-LusC-ChuN-CouR-APIProject',
  'Wor0205-MasJ-OgdD-VesA',
  'Wor0205-HelR-MatD-PotS-RowC',
  'Wor0205-VanA-LusC-ChuN-CouR-FirstNodeJSProject'
];

async function fetchContributors(repo) {
  const url = `https://api.github.com/repos/fac-31/${repo}/contributors`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch ${repo}: ${response.statusText}`);
      return [];
    }
    const contributors = await response.json();
    return contributors.map(c => c.login);
  } catch (error) {
    console.error(`Error fetching ${repo}:`, error.message);
    return [];
  }
}

async function buildTeamHistory() {
  console.log('Fetching team history from fac-31 organization...\n');

  const teamHistory = [];
  const allPeople = new Set();

  for (const repo of REPOS) {
    const contributors = await fetchContributors(repo);
    if (contributors.length > 0) {
      console.log(`${repo}: ${contributors.join(', ')}`);
      teamHistory.push({ repo, team: contributors });
      contributors.forEach(person => allPeople.add(person));
    }
    // Be nice to GitHub API
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`\n\nTotal unique contributors: ${allPeople.size}`);
  console.log(`Total teams (repositories): ${teamHistory.length}\n`);

  // Build conflict matrix
  const conflictMatrix = {};
  const peopleArray = Array.from(allPeople).sort();

  // Initialize matrix
  peopleArray.forEach(person => {
    conflictMatrix[person] = {};
  });

  // Count collaborations
  teamHistory.forEach(({ repo, team }) => {
    // For each pair in the team
    for (let i = 0; i < team.length; i++) {
      for (let j = i + 1; j < team.length; j++) {
        const person1 = team[i];
        const person2 = team[j];

        // Increment conflict count (symmetric)
        conflictMatrix[person1][person2] = (conflictMatrix[person1][person2] || 0) + 1;
        conflictMatrix[person2][person1] = (conflictMatrix[person2][person1] || 0) + 1;
      }
    }
  });

  // Build people array with IDs
  const people = peopleArray.map((login, idx) => ({
    id: String(idx + 1),
    name: login
  }));

  // Convert conflict matrix to use IDs instead of logins
  const conflictMatrixById = {};
  people.forEach((person1, i) => {
    conflictMatrixById[person1.id] = {};
    people.forEach((person2, j) => {
      if (i !== j) {
        const count = conflictMatrix[person1.name][person2.name];
        if (count) {
          conflictMatrixById[person1.id][person2.id] = count;
        }
      }
    });
  });

  // Generate suggested team sizes
  const totalPeople = people.length;
  const suggestedTeamSizes = [];

  if (totalPeople % 4 === 0) {
    // Divisible by 4 - make teams of 4
    const numTeams = totalPeople / 4;
    suggestedTeamSizes.push(Array(numTeams).fill(4));
  }

  if (totalPeople % 3 === 0) {
    // Divisible by 3 - make teams of 3
    const numTeams = totalPeople / 3;
    suggestedTeamSizes.push(Array(numTeams).fill(3));
  }

  // Mixed teams
  if (totalPeople >= 7) {
    const numTeamsOf4 = Math.floor(totalPeople / 4);
    const remainder = totalPeople % 4;

    if (remainder === 0) {
      // Already handled above
    } else if (remainder === 1 && numTeamsOf4 >= 2) {
      // Make one team of 5, rest teams of 4
      suggestedTeamSizes.push([5, ...Array(numTeamsOf4 - 1).fill(4)]);
    } else if (remainder === 2) {
      // Make two teams of 3, rest teams of 4
      if (numTeamsOf4 >= 1) {
        suggestedTeamSizes.push([3, 3, ...Array(numTeamsOf4 - 1).fill(4)]);
      }
    } else if (remainder === 3) {
      // Make one team of 3, rest teams of 4
      suggestedTeamSizes.push([3, ...Array(numTeamsOf4).fill(4)]);
    }
  }

  const result = {
    people,
    conflictMatrix: conflictMatrixById,
    suggestedTeamSizes,
    teamHistory: teamHistory.map(({ repo, team }) => ({
      repo,
      team: team.map(login => {
        const person = people.find(p => p.name === login);
        return person ? person.id : null;
      }).filter(Boolean)
    })),
    metadata: {
      totalPeople: people.length,
      totalTeams: teamHistory.length,
      fetchedAt: new Date().toISOString()
    }
  };

  return result;
}

// Run the script
buildTeamHistory().then(result => {
  console.log('\n=== EXAMPLE DATA ===\n');
  console.log('Copy this into your application:\n');
  console.log(JSON.stringify(result, null, 2));

  console.log('\n\n=== STATISTICS ===');
  console.log(`Total people: ${result.people.length}`);
  console.log(`Total past teams: ${result.metadata.totalTeams}`);
  console.log(`Suggested team sizes: ${result.suggestedTeamSizes.map(sizes => `[${sizes}]`).join(', ')}`);

  // Show most frequent collaborators
  console.log('\n=== TOP COLLABORATIONS ===');
  const collaborations = [];
  result.people.forEach(person1 => {
    Object.entries(result.conflictMatrix[person1.id] || {}).forEach(([person2Id, count]) => {
      const person2 = result.people.find(p => p.id === person2Id);
      if (person2 && person1.id < person2.id) {
        collaborations.push({
          pair: `${person1.name} & ${person2.name}`,
          count
        });
      }
    });
  });

  collaborations.sort((a, b) => b.count - a.count);
  collaborations.slice(0, 10).forEach(({ pair, count }) => {
    console.log(`${pair}: ${count} times`);
  });
}).catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
