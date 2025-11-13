require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const userRoutes = require('./routes/userRoutes');
const quickbooksRoutes = require('./routes/quickbooksRoutes');
const revenueRoutes = require('./routes/revenueRoutes');
const connectDB = require('./config/db');

const app = express();

// Middleware
// app.use(cors());
app.use(cors({
  origin: '*', // Allow all domains
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());


// Routes
app.use('/api/users', userRoutes);
app.use('/api/quickbooks/', quickbooksRoutes);
app.use('/api/revenue/', revenueRoutes);

// Connect to MongoDB
connectDB();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
