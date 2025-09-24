// backend/index.js
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();

// --- CORS Configuration ---
// Set your frontend's domain as the allowed origin.
// In this case, it's the Vercel URL.
const allowedOrigins = ["https://ctrl-f2-frontend.vercel.app"];
const corsOptions = {
  origin: function (origin, callback) {
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  // Optional: Add headers if your frontend sends them (e.g., authorization headers)
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
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
  try {
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
    console.log("Tables initialized successfully.");
  } catch (err) {
    console.error("Error initializing tables:", err);
  }
};
initTables();

// --- Questions ---
const questions = [
  {
    id: 1,
    question: "Clue: 01010011 01010100 01000001 01010010 01010100",
    answer: "start",
    clue: "It's not a word, is it?",
  },
  {
    id: 2,
    question:
      "Location: Take the steps down to the secret island below. Search for the water once danced… but oops! It’s gone on a vacation. Your clue waits where the dry droplets sit",
    answer: "binomial",
    clue: "It's the pride of CSE's hometown",
  },
  {
    id: 3,
    question:
      "Location: No kings, no queens, only a table where everyone’s opinion matters. Sit in the circle of wisdom — your next clue is hiding there",
    answer: "firewall",
    clue: "You should know the round table, but maybe it's not the easier one",
  },
  {
    id: 4,
    question:
      "Location: -.. .-. .. -. -.- .. -. --. / .-- .- - . .-. / ... .--. --- -  its the “main” spot",
    answer: "deque",
    clue: "Mars Co",
  },
  {
    id: 5,
    question:
      "Your next clue isn’t in bricks and benches, It’s in likes and follows. If you’re an engineer, you know IE. If you’re from here, you know TCE. Add a dot in between… and stop overthinking",
    answer: "recursion",
    clue: "search in the ocean where you reel",
  },
  {
    id: 6,
    question:
      "Location: Legends say the numbers 0x49 and 0x46 guard a secret. Combine them with the SECOND sign you see and the classroom whispers your next move.",
    answer: "if2",
    clue: "It's definitely not in CSE. IT maybe",
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

// Get question by ID — now also returns clue
app.get("/question/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const question = questions.find((q) => q.id === id);
  if (!question) return res.status(404).json({ error: "Question not found" });
  res.json({ question: question.question, clue: question.clue });
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
