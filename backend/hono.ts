import { Hono } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { cors } from "hono/cors";
import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";

// app will be mounted at /api
const app = new Hono();

// Enable CORS for all routes
app.use("*", cors());

// Mount tRPC router at /trpc
app.use(
  "/trpc/*",
  trpcServer({
    endpoint: "/api/trpc",
    router: appRouter,
    createContext,
  })
);

// Simple health check endpoint
app.get("/", (c) => {
  return c.json({ status: "ok", message: "API is running", timestamp: new Date().toISOString() });
});

// Health check for tRPC
app.get("/health", (c) => {
  return c.json({ 
    status: "healthy", 
    message: "tRPC API is running", 
    timestamp: new Date().toISOString(),
    endpoints: {
      trpc: "/api/trpc",
      health: "/api/health",
      test: "/api/test"
    },
    environment: {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ? 'configured' : 'missing',
      supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ? 'configured' : 'missing'
    }
  });
});

// Simple test endpoint to verify API is working
app.get("/test", (c) => {
  return c.json({ 
    message: "API test successful", 
    timestamp: new Date().toISOString(),
    method: c.req.method,
    url: c.req.url,
    headers: Object.fromEntries(c.req.raw.headers.entries())
  });
});

// Test endpoint with CORS headers
app.options("/test", (c) => {
  return c.json({ message: "CORS preflight successful" });
});

export default app;