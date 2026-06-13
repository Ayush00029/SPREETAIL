const express = require('express');
const cors = require('cors');
const authRouter = require('./routes/auth');
const groupsRouter = require('./routes/groups');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/auth', authRouter);
app.use('/groups', groupsRouter);

// Basic health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
