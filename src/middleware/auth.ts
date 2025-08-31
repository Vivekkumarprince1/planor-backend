import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { User } from '../models/User';

export interface AuthPayload { _id: string; role: 'user'|'manager'|'admin' }

export function auth(req: Request & { user?: AuthPayload }, res: Response, next: NextFunction) {
  const hdr = req.headers.authorization;
  if (!hdr?.startsWith('Bearer ')) return res.status(401).json({ success: false, error: 'Unauthorized' });
  const token = hdr.slice(7);
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AuthPayload;
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
}

export function requireRole(role: AuthPayload['role']) {
  return (req: Request & { user?: AuthPayload }, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });
    if (req.user.role !== role) return res.status(403).json({ success: false, error: 'Forbidden' });
    next();
  };
}

export function requireApprovedManager(req: Request & { user?: AuthPayload }, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });
  if (req.user.role !== 'manager') return res.status(403).json({ success: false, error: 'Manager role required' });
  
  // Check if manager is approved
  User.findById(req.user._id).then(user => {
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    if (user.blocked) return res.status(403).json({ success: false, error: 'Account is blocked' });
    if (!user.approved) return res.status(403).json({ success: false, error: 'Manager account pending approval' });
    next();
  }).catch(error => {
    console.error('Error checking manager approval:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  });
}

export function requireActiveUser(req: Request & { user?: AuthPayload }, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });
  
  User.findById(req.user._id).then(user => {
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    if (user.blocked) return res.status(403).json({ success: false, error: 'Account is blocked' });
    next();
  }).catch(error => {
    console.error('Error checking user status:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  });
}
