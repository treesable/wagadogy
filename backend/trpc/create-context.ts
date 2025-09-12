import { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { createClient } from '@supabase/supabase-js';

// Context creation function
export const createContext = async (opts: FetchCreateContextFnOptions) => {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  // Get auth token from request headers
  const authHeader = opts.req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  
  console.log('[createContext] Auth header exists:', !!authHeader);
  console.log('[createContext] Token exists:', !!token);
  console.log('[createContext] Token length:', token?.length || 0);
  console.log('[createContext] Auth header preview:', authHeader ? authHeader.substring(0, 20) + '...' : 'null');
  
  // Log all headers for debugging
  const allHeaders: Record<string, string> = {};
  opts.req.headers.forEach((value, key) => {
    allHeaders[key] = key.toLowerCase().includes('auth') ? value.substring(0, 20) + '...' : value;
  });
  console.log('[createContext] All request headers:', allHeaders);
  
  let user = null;
  let authenticatedSupabase = supabase;
  
  if (token) {
    try {
      console.log('[createContext] Attempting to authenticate with token');
      
      // First, try to get user with the token directly
      const { data: { user: authUser }, error } = await supabase.auth.getUser(token);
      
      if (!error && authUser) {
        console.log('[createContext] Successfully authenticated user:', authUser.id);
        console.log('[createContext] User email:', authUser.email);
        console.log('[createContext] User confirmed:', !!authUser.email_confirmed_at);
        
        // For development, allow both confirmed and unconfirmed users
        // In production, you should only allow confirmed users
        user = authUser;
        
        // Create authenticated client for database operations
        authenticatedSupabase = createClient(supabaseUrl, supabaseAnonKey, {
          global: {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        });
        
        if (authUser.email_confirmed_at) {
          console.log('[createContext] User authentication successful and confirmed');
        } else {
          console.log('[createContext] User authentication successful but NOT confirmed - allowing for development');
          console.log('[createContext] In production, you should require email confirmation');
        }
      } else {
        console.error('[createContext] Error getting user from token:', error);
        console.error('[createContext] Error details:', JSON.stringify(error, null, 2));
        
        // If token is invalid, try to refresh it
        if (error?.message?.includes('Invalid JWT') || error?.message?.includes('expired')) {
          console.log('[createContext] Token appears to be expired or invalid');
        }
      }
    } catch (error) {
      console.error('[createContext] Exception getting user from token:', error);
    }
  } else {
    console.log('[createContext] No token provided in request');
  }
  
  return {
    req: opts.req,
    supabase: authenticatedSupabase,
    user,
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;

// Initialize tRPC
const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

// Protected procedure that requires authentication
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  console.log('[protectedProcedure] Checking auth - user exists:', !!ctx.user);
  console.log('[protectedProcedure] User ID:', ctx.user?.id);
  console.log('[protectedProcedure] User email:', ctx.user?.email);
  console.log('[protectedProcedure] User confirmed:', !!ctx.user?.email_confirmed_at);
  
  if (!ctx.user) {
    console.error('[protectedProcedure] UNAUTHORIZED - no user in context');
    console.error('[protectedProcedure] This usually means the auth token is missing, invalid, or expired');
    throw new TRPCError({ 
      code: 'UNAUTHORIZED',
      message: 'Authentication required. Please sign in again.'
    });
  }
  
  // For development, be more lenient with email confirmation
  // In production, you should enforce email confirmation
  if (!ctx.user.email_confirmed_at) {
    console.warn('[protectedProcedure] WARNING - user not confirmed, but allowing for development');
    console.warn('[protectedProcedure] User ID:', ctx.user.id);
    console.warn('[protectedProcedure] User email:', ctx.user.email);
    console.warn('[protectedProcedure] In production, this should require confirmation');
    
    // For now, allow unconfirmed users to proceed
    // Uncomment the following lines to enforce email confirmation:
    // throw new TRPCError({ 
    //   code: 'UNAUTHORIZED',
    //   message: 'Please confirm your email address to continue.'
    // });
  }
  
  console.log('[protectedProcedure] Auth check passed for user:', ctx.user.id);
  return next({
    ctx: {
      ...ctx,
      user: ctx.user, // user is now guaranteed to be non-null
    },
  });
});