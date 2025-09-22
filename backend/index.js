const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Hardcoded questions and passwords
const questions = [
  {
    id: 1,
    question: "What is the capital of France?",
    password: "paris",
    clue: "It's also called the city of lights.",
  },
  { id: 2, question: "What is 5 + 7?", password: "12", clue: "Think dozen." },
  {
    id: 3,
    question: "What color do you get by mixing red and white?",
    password: "pink",
    clue: "A light red shade.",
  },
  {
    id: 4,
    question: "What is the chemical symbol for water?",
    password: "h2o",
    clue: "Two hydrogens, one oxygen.",
  },
  {
    id: 5,
    question: "Which planet is known as the Red Planet?",
    password: "mars",
    clue: "Named after the Roman god of war.",
  },
];

// Endpoint to get question by ID
app.get("/question/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const question = questions.find((q) => q.id === id);
  if (!question) return res.status(404).json({ error: "Question not found" });
  return res.json({ question: question.question });
});

// Endpoint to verify password and get clue
app.post("/verify", (req, res) => {
  const { questionId, password } = req.body;
  const question = questions.find((q) => q.id === questionId);
  if (!question) return res.status(404).json({ error: "Question not found" });

  if (questionId === 5) {
    // Automatically succeed for question 5 without password
    return res.json({ success: true, clue: question.clue });
  }

  if (password.toLowerCase() === question.password.toLowerCase()) {
    return res.json({ success: true, clue: question.clue });
  } else {
    return res.json({ success: false });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
