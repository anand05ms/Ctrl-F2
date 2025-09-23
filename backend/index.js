// backend/index.js
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(express.json());

// --- PostgreSQL Setup ---
const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
});

// --- Initialize tables ---
const initTables = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS teams (
      id SERIAL PRIMARY KEY,
      teamName TEXT UNIQUE
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS progress (
      id SERIAL PRIMARY KEY,
      teamId INT REFERENCES teams(id),
      clueId INT,
      clearedAt TEXT
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS submissions (
      id SERIAL PRIMARY KEY,
      teamId INT REFERENCES teams(id),
      teamName TEXT,
      questionId INT,
      answer TEXT,
      submittedAt TEXT
    );
  `);
};
initTables().catch(console.error);

// --- Questions ---
const questions = [
  {
    id: 1,
    question: "What is the capital of France?",
    answer: "paris",
    clue: "It's also called the city of lights.",
  },
  { id: 2, question: "What is 5 + 7?", answer: "12", clue: "Think dozen." },
  {
    id: 3,
    question: "What color do you get by mixing red and white?",
    answer: "pink",
    clue: "A light red shade.",
  },
  {
    id: 4,
    question: "What is the chemical symbol for water?",
    answer: "h2o",
    clue: "Two hydrogens, one oxygen.",
  },
  {
    id: 5,
    question: "Which planet is known as the Red Planet?",
    answer: "mars",
    clue: "Named after the Roman god of war.",
  },
];

// --- Routes ---

// Login or register a team
app.post("/login", async (req, res) => {
  const { teamName } = req.body;
  if (!teamName) return res.status(400).json({ error: "Team name required" });

  try {
    let team = await pool.query("SELECT * FROM teams WHERE teamName = $1", [
      teamName,
    ]);
    if (team.rows.length === 0) {
      const insert = await pool.query(
        "INSERT INTO teams (teamName) VALUES ($1) RETURNING *",
        [teamName]
      );
      team = insert;
    }
    res.json({
      success: true,
      teamId: team.rows[0].id,
      teamName: team.rows[0].teamName,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// Get question by ID
app.get("/question/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const question = questions.find((q) => q.id === id);
  if (!question) return res.status(404).json({ error: "Question not found" });
  res.json({ question: question.question });
});

// Verify answer + log progress + record submission
app.post("/verify", async (req, res) => {
  const { questionId, answer, teamId } = req.body;
  const question = questions.find((q) => q.id === questionId);
  if (!question) return res.status(404).json({ error: "Question not found" });

  try {
    const teamResult = await pool.query("SELECT * FROM teams WHERE id = $1", [
      teamId,
    ]);
    if (teamResult.rows.length === 0)
      return res.status(400).json({ error: "Invalid team id" });

    const team = teamResult.rows[0];
    const localTime = new Date().toLocaleString();

    // Log submission
    await pool.query(
      "INSERT INTO submissions (teamId, teamName, questionId, answer, submittedAt) VALUES ($1,$2,$3,$4,$5)",
      [team.id, team.teamName, questionId, answer, localTime]
    );

    // Check correctness
    if (answer.trim().toLowerCase() === question.answer.trim().toLowerCase()) {
      await pool.query(
        "INSERT INTO progress (teamId, clueId, clearedAt) VALUES ($1,$2,$3)",
        [team.id, questionId, localTime]
      );
      res.json({ success: true, clue: question.clue });
    } else {
      res.json({ success: false });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// Get team progress
app.get("/progress/:teamId", async (req, res) => {
  const teamId = parseInt(req.params.teamId);
  try {
    const result = await pool.query(
      "SELECT clueId, clearedAt FROM progress WHERE teamId=$1 ORDER BY clearedAt",
      [teamId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// Admin: see submissions
app.get("/submissions", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM submissions ORDER BY submittedAt"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
