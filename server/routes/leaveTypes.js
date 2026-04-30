const express = require('express');
const router = express.Router();
const { 
  getLeaveTypes, 
  createLeaveType, 
  updateLeaveType, 
  deleteLeaveType 
} = require('../controllers/leaveTypeController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

router.get('/', authMiddleware, getLeaveTypes);
router.post('/', authMiddleware, adminMiddleware, createLeaveType);
router.put('/:id', authMiddleware, adminMiddleware, updateLeaveType);
router.delete('/:id', authMiddleware, adminMiddleware, deleteLeaveType);

module.exports = router;
