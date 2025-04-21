import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { registerAiAdminRoutes } from "./lib/aiAdminRoutes";
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { pool } from './db';
import authRoutes from './routes/auth';
import configRoutes from './routes/config';
import itinerariesRoutes from './routes/itineraries';
import { attachCurrentUser } from './middleware/requireAuth';

// Import config module
import './config';

// Set up session store
const PgSession = connectPgSimple(session);

// Check for session secret
if (!process.env.SESSION_SECRET) {
  console.warn('Warning: SESSION_SECRET not set in environment. Using a default secret. This is not secure for production.');
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Configure session middleware
app.use(session({
  store: new PgSession({
    pool,
    tableName: 'sessions' // Must match the table name in your schema
  }),
  secret: process.env.SESSION_SECRET || 'nyc-day-planner-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  }
}));

// Attach current user to all requests for easy access
app.use(attachCurrentUser);

// Register authentication routes
app.use('/api/auth', authRoutes);

// Register configuration routes
app.use('/api/config', configRoutes);

// Register itineraries routes
app.use('/api/itineraries', itinerariesRoutes);

app.use('/NYC', express.static('dist/public')); // Added static file serving for NYC route

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Add database migration check
  console.log("Running database migrations...");

  // Add this function to ensure database tables exist
  async function ensureDatabaseTables() {
    try {
      // Check if the places table exists
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'places'
        );
      `);
      
      const placesTableExists = tableCheck.rows[0].exists;
      
      if (!placesTableExists) {
        console.log("Places table does not exist, creating it now...");
        
        // Create the places table
        await pool.query(`
          CREATE TABLE IF NOT EXISTS places (
            id SERIAL PRIMARY KEY,
            place_id TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            address TEXT NOT NULL,
            location JSONB NOT NULL,
            details JSONB NOT NULL,
            alternatives JSONB,
            scheduled_time TEXT
          );
        `);
        
        console.log("Places table created successfully.");
      }
      
      // Similarly check for itineraries table
      const itinerariesCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'itineraries'
        );
      `);
      
      const itinerariesTableExists = itinerariesCheck.rows[0].exists;
      
      if (!itinerariesTableExists) {
        console.log("Itineraries table does not exist, creating it now...");
        
        // Create the itineraries table
        await pool.query(`
          CREATE TABLE IF NOT EXISTS itineraries (
            id SERIAL PRIMARY KEY,
            query TEXT NOT NULL,
            places JSONB NOT NULL,
            travel_times JSONB NOT NULL,
            created TIMESTAMP NOT NULL DEFAULT NOW()
          );
        `);
        
        console.log("Itineraries table created successfully.");
      }
      
      // Check if the users table exists
      const usersCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'users'
        );
      `);
      
      const usersTableExists = usersCheck.rows[0].exists;
      
      if (!usersTableExists) {
        console.log("Users table does not exist, creating it now...");
        
        // Create the users table
        await pool.query(`
          CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email VARCHAR(255) NOT NULL UNIQUE,
            password_hash TEXT,
            name TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            avatar_url TEXT,
            google_id TEXT UNIQUE,
            auth_provider TEXT DEFAULT 'local'
          );
        `);
        
        console.log("Users table created successfully.");
      }
      
      // Check if the user_itineraries table exists
      const userItinerariesCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'user_itineraries'
        );
      `);
      
      const userItinerariesTableExists = userItinerariesCheck.rows[0].exists;
      
      if (!userItinerariesTableExists) {
        console.log("User itineraries table does not exist, creating it now...");
        
        // Create the user_itineraries table
        await pool.query(`
          CREATE TABLE IF NOT EXISTS user_itineraries (
            id SERIAL PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES users(id),
            itinerary_id INTEGER NOT NULL REFERENCES itineraries(id),
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
          );
        `);
        
        console.log("User itineraries table created successfully.");
      }
      
      // Check if the sessions table exists
      const sessionsCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'sessions'
        );
      `);
      
      const sessionsTableExists = sessionsCheck.rows[0].exists;
      
      if (!sessionsTableExists) {
        console.log("Sessions table does not exist, creating it now...");
        
        // Create the sessions table
        await pool.query(`
          CREATE TABLE IF NOT EXISTS sessions (
            sid VARCHAR(255) NOT NULL PRIMARY KEY,
            sess JSONB NOT NULL,
            expire TIMESTAMP NOT NULL
          );
        `);
        
        console.log("Sessions table created successfully.");
      }
      
      console.log("Database tables verified successfully.");
    } catch (error) {
      console.error("Error ensuring database tables:", error);
      throw error;
    }
  }

  // Call this function before starting the server
  await ensureDatabaseTables();

  const server = await registerRoutes(app);

  // Register AI admin routes
  registerAiAdminRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();