"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = require("../models/User");
const auth_1 = require("../middleware/auth");
const env_1 = require("../config/env");
const router = (0, express_1.Router)();
const registerSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
    role: zod_1.z.enum(['user', 'manager']).optional(),
});
router.post('/register', async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ success: false, error: parsed.error.flatten() });
    const { name, email, password, role } = parsed.data;
    const exists = await User_1.User.findOne({ email });
    if (exists)
        return res.status(409).json({ success: false, error: 'Email exists' });
    const passwordHash = await bcrypt_1.default.hash(password, 10);
    const user = await User_1.User.create({ name, email, passwordHash, role: role || 'user' });
    return res.json({ success: true, data: { _id: user._id, name: user.name, email: user.email } });
});
const loginSchema = zod_1.z.object({ email: zod_1.z.string().email(), password: zod_1.z.string().min(6) });
router.post('/login', async (req, res) => {
    console.log('🔐 Login attempt:', { email: req.body.email, passwordLength: req.body.password?.length });
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
        console.log('❌ Validation failed:', parsed.error.flatten());
        return res.status(400).json({ success: false, error: parsed.error.flatten() });
    }
    const { email, password } = parsed.data;
    console.log('✅ Validation passed, finding user with email:', email);
    const user = await User_1.User.findOne({ email });
    if (!user) {
        console.log('❌ User not found in database for email:', email);
        return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    console.log('✅ User found:', { id: user._id, email: user.email, hasPassword: !!user.passwordHash });
    const ok = await bcrypt_1.default.compare(password, user.passwordHash);
    console.log('🔍 Password comparison result:', ok);
    if (!ok) {
        console.log('❌ Password comparison failed');
        return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    console.log('✅ Login successful, generating tokens...');
    const uid = user._id.toString();
    const access = jsonwebtoken_1.default.sign({ _id: uid, role: user.role }, env_1.env.JWT_ACCESS_SECRET, { expiresIn: env_1.env.JWT_ACCESS_TTL });
    const refresh = jsonwebtoken_1.default.sign({ _id: uid, role: user.role }, env_1.env.JWT_REFRESH_SECRET, { expiresIn: env_1.env.JWT_REFRESH_TTL });
    // Return format that matches mobile app expectations
    return res.json({
        success: true,
        accessToken: access,
        refreshToken: refresh,
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            phone: user.phone,
            area: user.area
        }
    });
});
router.get('/me', auth_1.auth, async (req, res) => {
    const user = await User_1.User.findById(req.user._id).select('-passwordHash');
    if (!user)
        return res.status(404).json({ success: false, error: 'Not found' });
    return res.json({ success: true, data: user });
});
exports.default = router;
