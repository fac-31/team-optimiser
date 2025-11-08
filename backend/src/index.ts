import express from 'express';
import cors from 'cors';
import { optimizeTeams } from './teamOptimizer.js';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.post('/api/optimize', (req, res) => {
  try {
    const { people, teamSizes, conflictMatrix } = req.body;

    // Validate input
    if (!people || !teamSizes || !conflictMatrix) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const results = optimizeTeams(people, teamSizes, conflictMatrix);
    res.json(results);
  } catch (error) {
    console.error('Optimization error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
