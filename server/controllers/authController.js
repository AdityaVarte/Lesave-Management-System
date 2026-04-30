const jwt = require('jsonwebtoken');
const Employee = require('../models/Employee');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const employee = await Employee.findOne({ email: email.toLowerCase().trim() });
    if (!employee) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await employee.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(employee._id);

    res.json({
      token,
      user: {
        _id: employee._id,
        name: employee.name,
        email: employee.email,
        department: employee.department,
        role: employee.role,
        total_leaves: employee.total_leaves,
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/auth/me
const getMe = async (req, res, next) => {
  try {
    res.json({
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      department: req.user.department,
      role: req.user.role,
      total_leaves: req.user.total_leaves,
    });
  } catch (err) {
    next(err);
  }
};

// PUT /api/auth/profile
const updateProfile = async (req, res, next) => {
  try {
    const { name, email } = req.body;
    const employee = await Employee.findById(req.user._id);

    if (name) employee.name = name;
    if (email) employee.email = email.toLowerCase().trim();

    await employee.save();

    res.json({
      _id: employee._id,
      name: employee.name,
      email: employee.email,
      department: employee.department,
      role: employee.role,
      total_leaves: employee.total_leaves,
    });
  } catch (err) {
    next(err);
  }
};

// PUT /api/auth/change-password
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const employee = await Employee.findById(req.user._id);

    const isMatch = await employee.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    employee.password = newPassword;
    await employee.save();

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
};

module.exports = { login, getMe, updateProfile, changePassword };
