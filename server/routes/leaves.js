const express = require('express');
const router = express.Router();
const {
  getLeaves,
  getPendingLeaves,
  getLeave,
  applyLeave,
  approveLeave,
  rejectLeave,
  cancelLeave,
} = require('../controllers/leaveController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

// IMPORTANT: /pending must come before /:id so Express doesn't treat "pending" as an id
router.get('/pending', authMiddleware, adminMiddleware, getPendingLeaves);
router.get('/',        authMiddleware, getLeaves);
router.get('/:id',     authMiddleware, getLeave);
router.post('/',       authMiddleware, applyLeave);
router.put('/:id/approve', authMiddleware, adminMiddleware, approveLeave);
router.put('/:id/reject',  authMiddleware, adminMiddleware, rejectLeave);
router.put('/:id/cancel',  authMiddleware, cancelLeave);

module.exports = router;
