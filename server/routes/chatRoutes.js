const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { postChat, confirmAction, downloadPdfFile } = require('../controllers/chatController');
const authMiddleware = require('../middleware/authMiddleware');
const chatRateLimiter = require('../middleware/chatRateLimiter');

// Input validation rules for chat endpoint
const chatValidationRules = [
  body('message')
    .isString().withMessage('Message must be text')
    .trim()
    .notEmpty().withMessage('Message cannot be empty')
    .isLength({ max: 1500 }).withMessage('Message cannot exceed 1500 characters'),
  body('history')
    .optional()
    .isArray({ max: 30 }).withMessage('History must be an array of at most 30 turns'),
];

router.post(
  '/',
  authMiddleware,
  chatRateLimiter,
  chatValidationRules,
  postChat
);

router.post(
  '/confirm',
  authMiddleware,
  chatRateLimiter,
  confirmAction
);

router.get(
  '/files/:id',
  authMiddleware,
  downloadPdfFile
);

module.exports = router;
