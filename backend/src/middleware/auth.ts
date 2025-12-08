import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_change_me';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
  };
}

// Strictly requires a valid token. Used for History endpoints.
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ error: 'Access denied. Please log in.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    // Cast to AuthRequest to attach user
    (req as AuthRequest).user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid token.' });
  }
};

// Optional auth. Used for Generation endpoint (allows guests, but attaches user if present).
export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      (req as AuthRequest).user = decoded;
    } catch (err) {
      // Invalid token, just proceed as guest
      console.warn("Optional Auth: Invalid token provided");
    }
  }
  next();
};