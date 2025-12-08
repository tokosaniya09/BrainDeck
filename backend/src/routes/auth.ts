import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { pool } from '../db';
import { z } from 'zod';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_change_me';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1, "Name is required")
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

// --- Standard Email/Password Signup ---
router.post('/signup', async (req, res) => {
  try {
    const { email, password, name } = SignupSchema.parse(req.body);

    const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    const result = await pool.query(
      "INSERT INTO users (email, password_hash, auth_provider, name) VALUES ($1, $2, 'email', $3) RETURNING id, email, name",
      [email, hash, name]
    );
    const user = result.rows[0];

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name } });

  } catch (error: any) {
    // If Zod fails
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }
    res.status(400).json({ error: error.message || 'Signup failed' });
  }
});

// --- Standard Email/Password Login ---
router.post('/login', async (req, res) => {
  try {
    const { email, password } = LoginSchema.parse(req.body);

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    
    if (user.auth_provider === 'google') {
      return res.status(400).json({ error: 'Please log in with Google' });
    }

    if (!user.password_hash) {
      return res.status(400).json({ error: 'Invalid account state' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }
    res.status(500).json({ error: 'Login failed' });
  }
});

// --- Google Login ---
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    
    if (!credential) {
      return res.status(400).json({ error: 'No Google credential provided' });
    }

    // 1. Verify Google Token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(400).json({ error: 'Invalid Google Token' });
    }

    const email = payload.email;
    const name = payload.name || payload.given_name || 'User';

    // 2. Check if user exists
    let userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    let user;

    if (userResult.rows.length === 0) {
      // Create new user with auth_provider = 'google'
      const insert = await pool.query(
        "INSERT INTO users (email, auth_provider, name) VALUES ($1, 'google', $2) RETURNING id, email, name",
        [email, name]
      );
      user = insert.rows[0];
    } else {
      user = userResult.rows[0];
      
      // Optional: Update name if it's missing in DB but available in Google
      if (!user.name && name) {
        await pool.query('UPDATE users SET name = $1 WHERE id = $2', [name, user.id]);
        user.name = name;
      }
    }

    // 3. Issue JWT
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });

  } catch (error: any) {
    console.error('Google Auth Error:', error);
    res.status(400).json({ error: 'Google Authentication Failed' });
  }
});

export default router;