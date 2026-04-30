require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const authRoutes      = require('./routes/auth');
const employeeRoutes  = require('./routes/employees');
const leaveRoutes     = require('./routes/leaves');
const analyticsRoutes = require('./routes/analytics');
const leaveTypeRoutes = require('./routes/leaveTypes');
const errorHandler    = require('./middleware/errorHandler');
const seedData        = require('./seedData');

const app = express();

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/leaves',    leaveRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/leave-types', leaveTypeRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// ─── Error Handler ───────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Database + Start ────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected — LeaveFlow Atlas Cluster');
  } catch (err) {
    console.error('❌ Atlas connection failed (Likely IP Whitelist issue):', err.message);
    console.log('🌱 Starting Local MongoDB Memory Server for demonstration...');
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongod = await MongoMemoryServer.create();
      const uri = mongod.getUri();
      await mongoose.connect(uri);
      console.log('✅ Local MongoDB connected at:', uri);
    } catch (localErr) {
      console.error('❌ Failed to start local MongoDB:', localErr.message);
      process.exit(1);
    }
  }

  await seedData();
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
};

startServer();
