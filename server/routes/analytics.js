const express = require('express');
const router = express.Router();
const {
  getDashboard,
  getAdminDashboard,
  getMonthlyTrend,
  getDepartmentSummary,
} = require('../controllers/analyticsController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

router.get('/dashboard',          authMiddleware, getDashboard);
router.get('/admin-dashboard',    authMiddleware, adminMiddleware, getAdminDashboard);
router.get('/monthly-trend',      authMiddleware, adminMiddleware, getMonthlyTrend);
router.get('/department-summary', authMiddleware, adminMiddleware, getDepartmentSummary);

module.exports = router;
