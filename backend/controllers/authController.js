/**
 * Authentication controller.
 * Public registration is student-only. Admin/staff accounts must be managed
 * by the private seed-privileged.js script, never through the public API.
 */
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateToken = (id, role) => jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '7d' });

const registerUser = async (req, res) => {
  try {
    const { name, email, password, studentId } = req.body;
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!name || !normalizedEmail || !password) {
      return res.status(400).json({ success: false, message: 'Please provide name, email, and password' });
    }

    // Never trust a role supplied by a public client.
    if (req.body.role && req.body.role !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Public registration is student-only. Admin and staff accounts are managed by the system administrator.',
      });
    }

    if (!normalizedEmail.endsWith('@learner.manipal.edu')) {
      return res.status(400).json({ success: false, message: 'Students must use their @learner.manipal.edu email address' });
    }
    if (typeof studentId !== 'string' || !/^\d{9}$/.test(studentId.trim())) {
      return res.status(400).json({ success: false, message: 'Registration Number must contain exactly 9 digits' });
    }

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({ success: false, message: 'A user with this email address already exists' });
    }

    const user = await User.create({
      name,
      email: normalizedEmail,
      password,
      role: 'student',
      studentId: studentId.trim(),
    });
    const token = generateToken(user._id, user.role);

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, studentId: user.studentId, createdAt: user.createdAt },
    });
  } catch (error) {
    console.error(`[Register Error] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Server error during registration' });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select('+password');
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'Incorrect email or password' });
    }

    const token = generateToken(user._id, user.role);
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, studentId: user.studentId, createdAt: user.createdAt },
    });
  } catch (error) {
    console.error(`[Login Error] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Server error during login' });
  }
};

const getMe = async (req, res) => {
  try {
    return res.status(200).json({ success: true, user: req.user });
  } catch (error) {
    console.error(`[GetMe Error] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Server error retrieving profile' });
  }
};

module.exports = { registerUser, loginUser, getMe };
