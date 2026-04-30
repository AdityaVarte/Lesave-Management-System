const express = require('express');
const router = express.Router();
const {
  getAllEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} = require('../controllers/employeeController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

router.get('/',     authMiddleware, adminMiddleware, getAllEmployees);
router.get('/:id',  authMiddleware, getEmployee);
router.post('/',    authMiddleware, adminMiddleware, createEmployee);
router.put('/:id',  authMiddleware, adminMiddleware, updateEmployee);
router.delete('/:id', authMiddleware, adminMiddleware, deleteEmployee);

module.exports = router;
