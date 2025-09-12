import { z } from 'zod';
import { protectedProcedure } from '../../../create-context';

// Helper function to validate coordinates
function isValidCoordinate(coord: { latitude: number; longitude: number }): boolean {
  return (
    typeof coord.latitude === 'number' &&
    typeof coord.longitude === 'number' &&
    !isNaN(coord.latitude) &&
    !isNaN(coord.longitude) &&
    isFinite(coord.latitude) &&
    isFinite(coord.longitude) &&
    coord.latitude >= -90 &&
    coord.latitude <= 90 &&
    coord.longitude >= -180 &&
    coord.longitude <= 180
  );
}

const saveWalkSessionSchema = z.object({
  dog_id: z.string().uuid().optional(),
  scheduled_walk_id: z.string().uuid().optional(),
  start_time: z.string().datetime(),
  end_time: z.string().datetime().optional(),
  duration_minutes: z.number().int().min(0).optional(),
  distance_km: z.number().nonnegative().optional(),
  steps: z.number().int().nonnegative().optional(),
  calories_burned: z.number().int().nonnegative().optional(),
  route_coordinates: z.array(z.object({
    latitude: z.number(),
    longitude: z.number(),
    timestamp: z.number()
  })).optional(),
  start_location: z.object({
    latitude: z.number(),
    longitude: z.number()
  }).optional(),
  end_location: z.object({
    latitude: z.number(),
    longitude: z.number()
  }).optional(),
  weather_conditions: z.record(z.string(), z.any()).optional(),
  notes: z.string().optional(),
  photos: z.array(z.string()).optional(),
  is_completed: z.boolean().default(true)
});

export const saveWalkSessionProcedure = protectedProcedure
  .input(saveWalkSessionSchema)
  .mutation(async ({ ctx, input }) => {
    console.log('[saveWalkSession] Saving walk session for user:', ctx.user.id);
    console.log('[saveWalkSession] Input data:', input);

    try {
      // Prepare the walk session data with proper geographic columns
      const insertData: any = {
        user_id: ctx.user.id,
        dog_id: input.dog_id,
        scheduled_walk_id: input.scheduled_walk_id,
        start_time: input.start_time,
        end_time: input.end_time,
        duration_minutes: input.duration_minutes,
        distance_km: input.distance_km,
        steps: input.steps,
        calories_burned: input.calories_burned,
        weather_conditions: input.weather_conditions,
        notes: input.notes,
        photos: input.photos,
        is_completed: input.is_completed,
        created_at: new Date().toISOString()
      };

      // Add geographic data using proper PostGIS format for Supabase geography columns
      if (input.start_location && isValidCoordinate(input.start_location)) {
        // Use WKT (Well-Known Text) format for PostGIS geography columns
        insertData.start_location = `POINT(${input.start_location.longitude} ${input.start_location.latitude})`;
      }
      
      if (input.end_location && isValidCoordinate(input.end_location)) {
        // Use WKT (Well-Known Text) format for PostGIS geography columns
        insertData.end_location = `POINT(${input.end_location.longitude} ${input.end_location.latitude})`;
      }
      
      if (input.route_coordinates && input.route_coordinates.length > 1) {
        // Filter out invalid coordinates and store as WKT LineString for PostGIS
        const validCoords = input.route_coordinates.filter(isValidCoordinate);
        if (validCoords.length > 1) {
          const coordinateString = validCoords
            .map(coord => `${coord.longitude} ${coord.latitude}`)
            .join(',');
          insertData.route_coordinates = `LINESTRING(${coordinateString})`;
        } else if (validCoords.length === 1) {
          const coord = validCoords[0];
          insertData.route_coordinates = `POINT(${coord.longitude} ${coord.latitude})`;
        }
      } else if (input.route_coordinates && input.route_coordinates.length === 1) {
        // If only one coordinate, store as a Point instead
        const coord = input.route_coordinates[0];
        if (isValidCoordinate(coord)) {
          insertData.route_coordinates = `POINT(${coord.longitude} ${coord.latitude})`;
        }
      }
      
      // Store additional metadata in notes if needed
      if (input.notes || input.route_coordinates?.length) {
        let notesData: any = {};
        if (input.notes) {
          notesData.userNotes = input.notes;
        }
        if (input.route_coordinates?.length) {
          notesData.routeMetadata = {
            totalPoints: input.route_coordinates.length,
            startTime: input.route_coordinates[0]?.timestamp,
            endTime: input.route_coordinates[input.route_coordinates.length - 1]?.timestamp
          };
        }
        insertData.notes = JSON.stringify(notesData);
      }

      const { data: walkSession, error: insertError } = await ctx.supabase
        .from('walk_sessions')
        .insert(insertData)
        .select()
        .single();

      if (insertError) {
        console.error('[saveWalkSession] Insert failed:', insertError);
        throw new Error(`Failed to save walk session: ${insertError.message}`);
      }

      console.log('[saveWalkSession] Walk session inserted:', walkSession.id);

      // Update user statistics - this is critical for the user_statistics table
      try {
        console.log('[saveWalkSession] About to update user statistics...');
        console.log('[saveWalkSession] User ID for stats update:', ctx.user.id);
        console.log('[saveWalkSession] Walk data for stats:', {
          distance_km: input.distance_km || 0,
          duration_minutes: input.duration_minutes || 0,
          steps: input.steps || 0,
          calories_burned: input.calories_burned || 0
        });
        
        const statsResult = await updateUserStatistics(
          ctx.supabase, 
          ctx.user.id, 
          {
            distance_km: input.distance_km || 0,
            duration_minutes: input.duration_minutes || 0,
            steps: input.steps || 0,
            calories_burned: input.calories_burned || 0
          }
        );
        
        console.log('[saveWalkSession] User statistics updated successfully:', statsResult);
        
      } catch (statsError: any) {
        console.error('[saveWalkSession] CRITICAL: User statistics update failed:', statsError);
        console.error('[saveWalkSession] Stats error details:', {
          message: statsError?.message,
          code: statsError?.code,
          details: statsError?.details,
          hint: statsError?.hint,
          stack: statsError?.stack
        });
        
        // Try a direct insert/update as a fallback
        try {
          console.log('[saveWalkSession] Attempting direct user_statistics fallback...');
          const fallbackResult = await directUpdateUserStats(ctx.supabase, ctx.user.id, {
            distance_km: input.distance_km || 0,
            duration_minutes: input.duration_minutes || 0,
            steps: input.steps || 0,
            calories_burned: input.calories_burned || 0
          });
          console.log('[saveWalkSession] Direct fallback successful:', fallbackResult);
        } catch (fallbackError: any) {
          console.error('[saveWalkSession] Even direct fallback failed:', fallbackError);
          console.error('[saveWalkSession] Fallback error details:', {
            message: fallbackError?.message,
            code: fallbackError?.code,
            details: fallbackError?.details,
            hint: fallbackError?.hint
          });
          // Don't throw here - we want to save the walk session even if stats update fails
          console.warn('[saveWalkSession] Walk session saved but ALL statistics update methods failed');
        }
      }

      console.log('[saveWalkSession] Walk session saved successfully:', walkSession.id);
      return walkSession;
    } catch (error: any) {
      console.error('[saveWalkSession] Exception:', error);
      throw new Error(`Failed to save walk session: ${error.message}`);
    }
  });

// Helper function to update user statistics
async function updateUserStatistics(
  supabase: any,
  userId: string,
  walkData: {
    distance_km: number;
    duration_minutes: number;
    steps: number;
    calories_burned: number;
  }
) {
  try {
    console.log('[updateUserStatistics] Updating stats for user:', userId);
    console.log('[updateUserStatistics] Walk data:', walkData);
    
    // Get current user statistics
    const { data: currentStats, error: fetchError } = await supabase
      .from('user_statistics')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('[updateUserStatistics] Error fetching current stats:', fetchError);
      throw fetchError;
    }

    const now = new Date();
    const today = now.toISOString().split('T')[0];

    if (currentStats) {
      // Calculate new streak
      const newStreak = calculateStreak(currentStats.last_walk_date, today, currentStats.current_streak_days || 0);
      
      // Update existing statistics
      const updateData = {
        total_walks: (currentStats.total_walks || 0) + 1,
        total_distance_km: (currentStats.total_distance_km || 0) + walkData.distance_km,
        total_duration_minutes: (currentStats.total_duration_minutes || 0) + walkData.duration_minutes,
        total_steps: (currentStats.total_steps || 0) + walkData.steps,
        total_calories_burned: (currentStats.total_calories_burned || 0) + walkData.calories_burned,
        current_streak_days: newStreak,
        longest_streak_days: Math.max(
          currentStats.longest_streak_days || 0,
          newStreak
        ),
        last_walk_date: today,
        updated_at: now.toISOString()
      };
      
      console.log('[updateUserStatistics] Updating with data:', updateData);
      
      const { error: updateError } = await supabase
        .from('user_statistics')
        .update(updateData)
        .eq('user_id', userId);

      if (updateError) {
        console.error('[updateUserStatistics] Error updating stats:', updateError);
        throw updateError;
      } else {
        console.log('[updateUserStatistics] Successfully updated existing stats');
      }
    } else {
      // Create new statistics record
      const insertData = {
        user_id: userId,
        total_walks: 1,
        total_distance_km: walkData.distance_km,
        total_duration_minutes: walkData.duration_minutes,
        total_steps: walkData.steps,
        total_calories_burned: walkData.calories_burned,
        current_streak_days: 1,
        longest_streak_days: 1,
        last_walk_date: today,
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      };
      
      console.log('[updateUserStatistics] Creating new stats with data:', insertData);

      const { error: insertError } = await supabase
        .from('user_statistics')
        .insert(insertData);

      if (insertError) {
        console.error('[updateUserStatistics] Error creating new stats:', insertError);
        throw insertError;
      } else {
        console.log('[updateUserStatistics] Successfully created new stats record');
      }
    }
  } catch (error: any) {
    console.error('[updateUserStatistics] Exception:', error);
    throw error;
  }
}

// Direct fallback function for user statistics update
async function directUpdateUserStats(
  supabase: any,
  userId: string,
  walkData: {
    distance_km: number;
    duration_minutes: number;
    steps: number;
    calories_burned: number;
  }
) {
  console.log('[directUpdateUserStats] Direct update attempt for user:', userId);
  
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  // First, try to get existing stats
  const { data: existingStats } = await supabase
    .from('user_statistics')
    .select('*')
    .eq('user_id', userId)
    .single();
    
  if (existingStats) {
    // Update existing record by adding to current values
    const newStreak = calculateStreak(existingStats.last_walk_date, today, existingStats.current_streak_days || 0);
    
    const { data, error } = await supabase
      .from('user_statistics')
      .update({
        total_walks: (existingStats.total_walks || 0) + 1,
        total_distance_km: (existingStats.total_distance_km || 0) + walkData.distance_km,
        total_duration_minutes: (existingStats.total_duration_minutes || 0) + walkData.duration_minutes,
        total_steps: (existingStats.total_steps || 0) + walkData.steps,
        total_calories_burned: (existingStats.total_calories_burned || 0) + walkData.calories_burned,
        current_streak_days: newStreak,
        longest_streak_days: Math.max(existingStats.longest_streak_days || 0, newStreak),
        last_walk_date: today,
        updated_at: now.toISOString()
      })
      .eq('user_id', userId)
      .select();
      
    if (error) {
      console.error('[directUpdateUserStats] Direct update failed:', error);
      throw error;
    }
    
    console.log('[directUpdateUserStats] Direct update successful:', data);
    return data;
  } else {
    // Create new record
    const { data, error } = await supabase
      .from('user_statistics')
      .insert({
        user_id: userId,
        total_walks: 1,
        total_distance_km: walkData.distance_km,
        total_duration_minutes: walkData.duration_minutes,
        total_steps: walkData.steps,
        total_calories_burned: walkData.calories_burned,
        current_streak_days: 1,
        longest_streak_days: 1,
        last_walk_date: today,
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      })
      .select();
      
    if (error) {
      console.error('[directUpdateUserStats] Direct insert failed:', error);
      throw error;
    }
    
    console.log('[directUpdateUserStats] Direct insert successful:', data);
    return data;
  }
}

// Helper function to calculate streak
function calculateStreak(lastWalkDate: string | null, todayDate: string, currentStreak: number): number {
  if (!lastWalkDate) return 1;
  
  const lastDate = new Date(lastWalkDate);
  const today = new Date(todayDate);
  const diffTime = today.getTime() - lastDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    // Same day, maintain current streak
    return currentStreak;
  } else if (diffDays === 1) {
    // Consecutive day, increment streak
    return currentStreak + 1;
  } else {
    // Gap in days, reset streak
    return 1;
  }
}