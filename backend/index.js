const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const Database = require("better-sqlite3");

const app = express();
app.use(cors());
app.use(express.json());

// --- Database Setup ---
const db = new Database("db.sqlite");

// Create tables if not exist
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teamName TEXT UNIQUE,
    passwordHash TEXT
  )
`
).run();

db.prepare(
  `
  CREATE TABLE IF NOT EXISTS progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teamId INTEGER,
    clueId INTEGER,
    clearedAt TEXT,
    FOREIGN KEY (teamId) REFERENCES teams(id)
  )
`
).run();

// --- Seed teams (only first run) ---
function seedTeams() {
  const existing = db.prepare("SELECT COUNT(*) as count FROM teams").get();
  if (existing.count === 0) {
    const insert = db.prepare(
      "INSERT INTO teams (teamName, passwordHash) VALUES (?, ?)"
    );
    const teams = [
      { teamName: "team1", password: "pass1" },
      { teamName: "team2", password: "pass2" },
    ];
    teams.forEach((t) => {
      const hash = bcrypt.hashSync(t.password, 10);
      insert.run(t.teamName, hash);
    });
    console.log("Seeded teams");
  }
}
seedTeams();

// --- Hardcoded questions ---
const questions = [
  {
    id: 1,
    question: "What is the capital of France?",
    answer: "paris",
    clue: "It's also called the city of lights.",
  },
  {
    id: 2,
    question: "What is 5 + 7?",
    answer: "12",
    clue: "Think dozen.",
  },
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

// Login route
app.post("/login", (req, res) => {
  const { teamName, password } = req.body;
  const team = db
    .prepare("SELECT * FROM teams WHERE teamName = ?")
    .get(teamName);

  if (!team) return res.status(401).json({ error: "Invalid team" });

  const match = bcrypt.compareSync(password, team.passwordHash);
  if (!match) return res.status(401).json({ error: "Invalid password" });

  res.json({ success: true, teamId: team.id });
});

// Get question by ID
app.get("/question/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const question = questions.find((q) => q.id === id);
  if (!question) return res.status(404).json({ error: "Question not found" });
  res.json({ question: question.question });
});

// Verify answer + log progress
app.post("/verify", (req, res) => {
  const { questionId, answer, teamName } = req.body;
  const question = questions.find((q) => q.id === questionId);
  if (!question) return res.status(404).json({ error: "Question not found" });

  const team = db
    .prepare("SELECT * FROM teams WHERE teamName = ?")
    .get(teamName);
  if (!team) return res.status(400).json({ error: "Invalid team name" });

  if (
    questionId === 5 ||
    answer.trim().toLowerCase() === question.answer.trim().toLowerCase()
  ) {
    db.prepare(
      "INSERT INTO progress (teamId, clueId, clearedAt) VALUES (?, ?, ?)"
    ).run(team.id, questionId, new Date().toISOString());
    return res.json({ success: true, clue: question.clue });
  } else {
    return res.json({ success: false });
  }
});

// Optional: Get team progress for admins
app.get("/progress", (req, res) => {
  const rows = db
    .prepare(
      `
    SELECT t.teamName, p.clueId, p.clearedAt
    FROM progress p
    JOIN teams t ON p.teamId = t.id
    ORDER BY t.teamName, p.clearedAt
  `
    )
    .all();
  res.json(rows);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
