"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auth = auth;
exports.requireRole = requireRole;
exports.requireApprovedManager = requireApprovedManager;
exports.requireActiveUser = requireActiveUser;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const User_1 = require("../models/User");
function auth(req, res, next) {
    const hdr = req.headers.authorization;
    if (!hdr?.startsWith('Bearer '))
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    const token = hdr.slice(7);
    try {
        const payload = jsonwebtoken_1.default.verify(token, env_1.env.JWT_ACCESS_SECRET);
        req.user = payload;
        next();
    }
    catch {
        return res.status(401).json({ success: false, error: 'Invalid token' });
    }
}
function requireRole(role) {
    return (req, res, next) => {
        if (!req.user)
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        if (req.user.role !== role)
            return res.status(403).json({ success: false, error: 'Forbidden' });
        next();
    };
}
function requireApprovedManager(req, res, next) {
    if (!req.user)
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    if (req.user.role !== 'manager')
        return res.status(403).json({ success: false, error: 'Manager role required' });
    // Check if manager is approved
    User_1.User.findById(req.user._id).then(user => {
        if (!user)
            return res.status(404).json({ success: false, error: 'User not found' });
        if (user.blocked)
            return res.status(403).json({ success: false, error: 'Account is blocked' });
        if (!user.approved)
            return res.status(403).json({ success: false, error: 'Manager account pending approval' });
        next();
    }).catch(error => {
        console.error('Error checking manager approval:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    });
}
function requireActiveUser(req, res, next) {
    if (!req.user)
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    User_1.User.findById(req.user._id).then(user => {
        if (!user)
            return res.status(404).json({ success: false, error: 'User not found' });
        if (user.blocked)
            return res.status(403).json({ success: false, error: 'Account is blocked' });
        next();
    }).catch(error => {
        console.error('Error checking user status:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    });
}
