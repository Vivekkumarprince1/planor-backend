import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt, { Secret } from 'jsonwebtoken';
import { User } from '../models/User';
import { auth } from '../middleware/auth';
import { env } from '../config/env';

const router = Router();

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['user', 'manager']).optional(),
});

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() });
  const { name, email, password, role } = parsed.data;
  const exists = await User.findOne({ email });
  if (exists) return res.status(409).json({ success: false, error: 'Email exists' });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, passwordHash, role: role || 'user' });
  return res.json({ success: true, data: { _id: user._id, name: user.name, email: user.email } });
});

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(6) });
router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() });
  const { email, password } = parsed.data;
  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ success: false, error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ success: false, error: 'Invalid credentials' });
  const uid = (user._id as any).toString();
  const access = jwt.sign({ _id: uid, role: user.role }, env.JWT_ACCESS_SECRET as Secret, { expiresIn: env.JWT_ACCESS_TTL as any });
  const refresh = jwt.sign({ _id: uid, role: user.role }, env.JWT_REFRESH_SECRET as Secret, { expiresIn: env.JWT_REFRESH_TTL as any });
  
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

router.get('/me', auth, async (req, res) => {
  const user = await User.findById((req as any).user._id).select('-passwordHash');
  if (!user) return res.status(404).json({ success: false, error: 'Not found' });
  return res.json({ success: true, data: user });
});

export default router;
