import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import IORedis from 'ioredis';
import { Request, Response } from 'express';

// Separate Redis client for rate limiting
const redisClient = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379');

// 1. General API Limiter (DDoS Protection)
// Limit each IP to 100 requests per 15 minutes
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  limit: 100, 
  standardHeaders: true, 
  legacyHeaders: false, 
  store: new RedisStore({
    sendCommand: (...args: string[]) => redisClient.call(args[0], ...args.slice(1)) as Promise<any>,
  }),
  message: { error: 'Too many requests from this IP, please try again after 15 minutes.' }
});

// 2. AI Generation Limiter (Cost Control)
// Guests: 10 requests/hour
// Users: 50 requests/hour
export const generationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: (req: Request) => {
    // If user is logged in (attached by optionalAuth), give higher limit
    if ((req as any).user) return 50;
    return 10;
  },
  keyGenerator: (req: Request) => {
    // If logged in, throttle by User ID. Otherwise, throttle by IP.
    if ((req as any).user) return `user-${(req as any).user.id}`;
    return (req as any).ip || '127.0.0.1';
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args: string[]) => redisClient.call(args[0], ...args.slice(1)) as Promise<any>,
  }),
  handler: (req: Request, res: Response) => {
     (res as any).status(429).json({ 
       error: 'Hourly generation limit reached. Guests: 10/hr, Users: 50/hr. Please try again later.' 
     });
  }
});