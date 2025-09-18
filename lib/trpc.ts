import { createTRPCReact } from "@trpc/react-query";
import { httpLink } from "@trpc/client";
import type { AppRouter } from "@/backend/trpc/app-router";
import superjson from "superjson";
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_RORK_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
  }

  throw new Error(
    "No base url found, please set EXPO_PUBLIC_RORK_API_BASE_URL"
  );
};

// Create a function to get the auth token
const getAuthToken = async () => {
  try {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.log('[getAuthToken] Missing Supabase environment variables');
      return null;
    }
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false, // Disable for mobile
      },
    });
    
    // First try to get the current session
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.error('[getAuthToken] Error getting session:', error);
      console.error('[getAuthToken] Session error details:', {
        message: error.message,
        status: error.status,
        name: error.name
      });
      
      // If it's a refresh token error, clear the session and return null
      if (error.message?.includes('Invalid Refresh Token') || error.message?.includes('refresh_token_not_found')) {
        console.log('[getAuthToken] Invalid refresh token detected, clearing session');
        await supabase.auth.signOut();
        return null;
      }
      
      return null;
    }
    
    if (!session) {
      console.log('[getAuthToken] No session found - user needs to sign in');
      return null;
    }
    
    if (!session.access_token) {
      console.log('[getAuthToken] Session exists but no access token - invalid session');
      return null;
    }
    
    // For development, allow both confirmed and unconfirmed users
    // In production, you should enforce email confirmation here
    if (!session.user?.email_confirmed_at) {
      console.log('[getAuthToken] User not confirmed, but allowing for development');
      console.log('[getAuthToken] In production, you should require email confirmation');
    }
    
    const token = session.access_token;
    console.log('[getAuthToken] Token exists:', !!token, 'Token length:', token?.length || 0);
    console.log('[getAuthToken] User ID:', session.user?.id);
    console.log('[getAuthToken] User email:', session.user?.email);
    console.log('[getAuthToken] User confirmed:', !!session.user?.email_confirmed_at);
    console.log('[getAuthToken] Token expires at:', session.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'never');
    
    // Verify token is not expired (with 5 minute buffer)
    const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
    if (session.expires_at && (session.expires_at * 1000 - bufferTime) < Date.now()) {
      console.log('[getAuthToken] Token is expired or expiring soon, attempting refresh');
      
      try {
        const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError) {
          console.error('[getAuthToken] Failed to refresh token:', refreshError);
          console.error('[getAuthToken] Refresh error details:', {
            message: refreshError?.message,
            status: refreshError?.status,
            name: refreshError?.name
          });
          
          // If refresh fails, sign out and return null
          if (refreshError.message?.includes('Invalid Refresh Token') || refreshError.message?.includes('refresh_token_not_found')) {
            console.log('[getAuthToken] Invalid refresh token during refresh, signing out');
            await supabase.auth.signOut();
          }
          
          return null;
        }
        
        if (!refreshedSession || !refreshedSession.access_token) {
          console.error('[getAuthToken] Refreshed session has no access token');
          return null;
        }
        
        console.log('[getAuthToken] Token refreshed successfully');
        console.log('[getAuthToken] New token expires at:', refreshedSession.expires_at ? new Date(refreshedSession.expires_at * 1000).toISOString() : 'never');
        return refreshedSession.access_token;
      } catch (refreshException) {
        console.error('[getAuthToken] Exception during token refresh:', refreshException);
        return null;
      }
    }
    
    console.log('[getAuthToken] Using existing valid token');
    return token;
  } catch (error: any) {
    console.error('[getAuthToken] Exception getting auth token:', error);
    console.error('[getAuthToken] Exception details:', {
      message: error?.message,
      name: error?.name,
      stack: error?.stack?.substring(0, 500)
    });
    return null;
  }
};

// Create a function to create tRPC client with auth
export const createTRPCClient = (getToken?: () => Promise<string | null>) => {
  const baseUrl = getBaseUrl();
  const fullUrl = `${baseUrl}/api/trpc`;
  
  console.log('[createTRPCClient] Base URL:', baseUrl);
  console.log('[createTRPCClient] Full tRPC URL:', fullUrl);
  
  return trpc.createClient({
    links: [
      httpLink({
        url: fullUrl,
        transformer: superjson,
        headers: async () => {
          try {
            const token = getToken ? await getToken() : await getAuthToken();
            console.log('[tRPC Headers] Token exists:', !!token);
            console.log('[tRPC Headers] Token length:', token?.length || 0);
            console.log('[tRPC Headers] Token preview:', token ? token.substring(0, 20) + '...' : 'null');
            
            if (!token) {
              console.log('[tRPC Headers] No token available - requests will be unauthenticated');
              return {};
            }
            
            const headers = {
              authorization: `Bearer ${token}`,
            };
            
            console.log('[tRPC Headers] Final headers:', {
              ...headers,
              authorization: headers.authorization ? headers.authorization.substring(0, 20) + '...' : undefined
            });
            
            return headers;
          } catch (error) {
            console.error('[tRPC Headers] Error getting auth headers:', error);
            return {};
          }
        },
        fetch: async (url, options) => {
          console.log('[tRPC Fetch] Making request to:', url);
          console.log('[tRPC Fetch] Request options:', {
            method: options?.method,
            headers: options?.headers ? Object.keys(options.headers) : [],
            bodyLength: options?.body ? (typeof options.body === 'string' ? options.body.length : 'non-string') : 0
          });
          
          try {
            // Add timeout to prevent hanging requests
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
            
            const response = await fetch(url, {
              ...options,
              signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            console.log('[tRPC Fetch] Response status:', response.status);
            console.log('[tRPC Fetch] Response ok:', response.ok);
            console.log('[tRPC Fetch] Response headers:', Object.fromEntries(response.headers.entries()));
            
            // Clone response to read body multiple times if needed
            const responseClone = response.clone();
            
            if (!response.ok) {
              let errorText = '';
              try {
                errorText = await response.text();
              } catch (textError) {
                console.error('[tRPC Fetch] Failed to read error response text:', textError);
                errorText = 'Failed to read error response';
              }
              
              console.error('[tRPC Fetch] Error response body (first 1000 chars):', errorText.substring(0, 1000));
              
              // Handle authentication errors specifically
              if (response.status === 401) {
                console.error('[tRPC Fetch] Authentication error (401) - token may be invalid or expired');
                throw new Error('UNAUTHORIZED: Authentication required. Please sign in again.');
              }
              
              // Handle forbidden errors
              if (response.status === 403) {
                console.error('[tRPC Fetch] Forbidden error (403) - insufficient permissions');
                throw new Error('FORBIDDEN: Insufficient permissions. Please check your account status.');
              }
              
              // Handle 404 errors specifically
              if (response.status === 404) {
                console.error('[tRPC Fetch] API endpoint not found (404)');
                throw new Error('API endpoint not found. The server may not be running or the endpoint may not exist.');
              }
              
              // Handle 500 errors
              if (response.status >= 500) {
                console.error('[tRPC Fetch] Server error (5xx)');
                throw new Error('Server error. Please try again later.');
              }
              
              // If we get HTML instead of JSON, it's likely a 404 or server error
              if (errorText.includes('<html>') || errorText.includes('<!DOCTYPE')) {
                console.error('[tRPC Fetch] Server returned HTML - likely 404 or server error');
                throw new Error(`Server returned HTML instead of JSON. Status: ${response.status}. This usually means the API endpoint is not found or the server is not running.`);
              }
              
              // Try to parse as JSON to provide better error messages
              try {
                const errorJson = JSON.parse(errorText);
                console.error('[tRPC Fetch] Parsed error JSON:', errorJson);
                
                // Extract meaningful error message from tRPC error format
                if (errorJson.error && errorJson.error.message) {
                  throw new Error(errorJson.error.message);
                } else if (errorJson.message) {
                  throw new Error(errorJson.message);
                } else {
                  throw new Error(`HTTP ${response.status}: ${JSON.stringify(errorJson)}`);
                }
              } catch (parseError) {
                console.error('[tRPC Fetch] Failed to parse error as JSON:', parseError);
                // If it's not valid JSON, just return the text
                throw new Error(`HTTP ${response.status}: ${errorText}`);
              }
            }
            
            // For successful responses, validate that it's JSON
            const contentType = response.headers.get('content-type');
            console.log('[tRPC Fetch] Response content-type:', contentType);
            
            // Check if response body is empty
            const responseText = await responseClone.text();
            if (!responseText || responseText.trim() === '') {
              console.error('[tRPC Fetch] Empty response body');
              throw new Error('Server returned empty response.');
            }
            
            // Check for HTML responses
            if (responseText.includes('<html>') || responseText.includes('<!DOCTYPE')) {
              console.error('[tRPC Fetch] Server returned HTML for successful response');
              console.error('[tRPC Fetch] HTML response (first 500 chars):', responseText.substring(0, 500));
              throw new Error('Server returned HTML instead of JSON. This usually means the API endpoint is not found or the server is not running properly.');
            }
            
            // Try to parse as JSON to validate
            try {
              JSON.parse(responseText);
              console.log('[tRPC Fetch] Response is valid JSON');
            } catch (jsonError) {
              console.error('[tRPC Fetch] Response is not valid JSON:', jsonError);
              console.error('[tRPC Fetch] Response text (first 500 chars):', responseText.substring(0, 500));
              throw new Error('Server returned invalid JSON. The response may be corrupted or the server may be misconfigured.');
            }
            
            // Log successful response for debugging
            if (response.ok) {
              console.log('[tRPC Fetch] Request successful');
            }
            
            return response;
          } catch (error: any) {
            console.error('[tRPC Fetch] Network error:', error);
            console.error('[tRPC Fetch] Error details:', {
              message: error?.message,
              name: error?.name,
              cause: error?.cause,
              stack: error?.stack?.substring(0, 500)
            });
            
            // Handle timeout errors
            if (error?.name === 'AbortError') {
              console.error('[tRPC Fetch] Request timeout');
              throw new Error('Request timeout. The server may be slow or unreachable.');
            }
            
            // Provide more specific error messages
            if (error?.message?.includes('JSON Parse error') || error?.message?.includes('Unexpected character')) {
              console.error('[tRPC Fetch] JSON parse error detected');
              throw new Error('Server returned invalid JSON. The API may not be running correctly or there may be a configuration issue.');
            }
            
            if (error?.message?.includes('Network request failed') || error?.message?.includes('fetch')) {
              console.error('[tRPC Fetch] Network connectivity issue');
              throw new Error('Network connection error. Please check your internet connection.');
            }
            
            if (error?.message?.includes('Authentication required')) {
              console.error('[tRPC Fetch] Authentication error detected');
              throw new Error('Authentication required. Please sign in again.');
            }
            
            // Re-throw the error with additional context
            throw error;
          }
        },
      }),
    ],
  });
};

// Default client for backward compatibility
export const trpcClient = createTRPCClient();