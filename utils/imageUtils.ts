import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import * as FileSystem from 'expo-file-system';

export interface ImageCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png';
}

export interface OptimizedImage {
  uri: string;
  width: number;
  height: number;
  size?: number; // File size in bytes
  compressed: boolean;
}

// Image optimization strategies used by popular apps
const IMAGE_OPTIMIZATION_PRESETS = {
  // For profile photos - high quality but reasonable size
  profile: {
    maxWidth: 800,
    maxHeight: 800,
    quality: 0.8,
    format: 'jpeg' as const,
  },
  // For gallery thumbnails - smaller size for fast loading
  thumbnail: {
    maxWidth: 300,
    maxHeight: 300,
    quality: 0.7,
    format: 'jpeg' as const,
  },
  // For full gallery view - balance between quality and size
  gallery: {
    maxWidth: 1200,
    maxHeight: 1200,
    quality: 0.85,
    format: 'jpeg' as const,
  },
};

/**
 * Compress and optimize image using strategies from popular apps
 * - Instagram: Progressive loading with thumbnails
 * - WhatsApp: Aggressive compression for fast sharing
 * - Tinder: Optimized for quick swiping
 */
export async function optimizeImage(
  uri: string,
  preset: keyof typeof IMAGE_OPTIMIZATION_PRESETS = 'profile'
): Promise<OptimizedImage> {
  try {
    console.log(`Optimizing image with preset: ${preset}`);
    const options = IMAGE_OPTIMIZATION_PRESETS[preset];
    
    // Get original image info
    const originalInfo = await ImageManipulator.manipulateAsync(
      uri,
      [],
      { format: ImageManipulator.SaveFormat.JPEG }
    );
    
    console.log('Original image dimensions:', originalInfo.width, 'x', originalInfo.height);
    
    // Calculate resize dimensions while maintaining aspect ratio
    const { width: originalWidth, height: originalHeight } = originalInfo;
    const aspectRatio = originalWidth / originalHeight;
    
    let targetWidth = options.maxWidth;
    let targetHeight = options.maxHeight;
    
    // Maintain aspect ratio
    if (aspectRatio > 1) {
      // Landscape
      targetHeight = Math.round(targetWidth / aspectRatio);
    } else {
      // Portrait or square
      targetWidth = Math.round(targetHeight * aspectRatio);
    }
    
    // Only resize if image is larger than target
    const needsResize = originalWidth > targetWidth || originalHeight > targetHeight;
    
    const manipulateActions = [];
    if (needsResize) {
      manipulateActions.push({
        resize: {
          width: targetWidth,
          height: targetHeight,
        },
      });
    }
    
    const result = await ImageManipulator.manipulateAsync(
      uri,
      manipulateActions,
      {
        compress: options.quality,
        format: options.format === 'jpeg' ? ImageManipulator.SaveFormat.JPEG : ImageManipulator.SaveFormat.PNG,
      }
    );
    
    console.log('Optimized image dimensions:', result.width, 'x', result.height);
    
    return {
      uri: result.uri,
      width: result.width,
      height: result.height,
      compressed: needsResize || options.quality < 1,
    };
  } catch (error) {
    console.error('Error optimizing image:', error);
    // Return original if optimization fails
    return {
      uri,
      width: 0,
      height: 0,
      compressed: false,
    };
  }
}

/**
 * Create multiple optimized versions of an image
 * Similar to how Instagram creates multiple sizes for different use cases
 */
export async function createImageVariants(uri: string): Promise<{
  thumbnail: OptimizedImage;
  gallery: OptimizedImage;
  profile: OptimizedImage;
}> {
  console.log('Creating image variants for:', uri);
  
  const [thumbnail, gallery, profile] = await Promise.all([
    optimizeImage(uri, 'thumbnail'),
    optimizeImage(uri, 'gallery'),
    optimizeImage(uri, 'profile'),
  ]);
  
  return { thumbnail, gallery, profile };
}

/**
 * Progressive image loading strategy
 * Load thumbnail first, then full image (like Instagram)
 */
export function getProgressiveImageSources(photoUrl: string) {
  // For now, we'll use the same URL but in a real app you'd have different sizes
  // This is where you'd implement CDN-based image resizing
  return {
    thumbnail: photoUrl,
    full: photoUrl,
  };
}

/**
 * Estimate image file size for data usage optimization
 */
export function estimateImageSize(width: number, height: number, quality: number = 0.8): number {
  // Rough estimation: JPEG compression typically achieves 10:1 to 20:1 compression
  const uncompressedSize = width * height * 3; // 3 bytes per pixel (RGB)
  const compressionRatio = quality > 0.8 ? 10 : quality > 0.6 ? 15 : 20;
  return Math.round(uncompressedSize / compressionRatio);
}

/**
 * Check if image should be compressed based on size and network conditions
 */
export function shouldCompressImage(width: number, height: number): boolean {
  const pixelCount = width * height;
  const threshold = 1000000; // 1MP threshold
  return pixelCount > threshold;
}

/**
 * Data usage optimization - compress more aggressively on mobile data
 */
export function getOptimalQuality(): number {
  // In a real app, you'd check network conditions
  // For now, we'll use a conservative approach
  if (Platform.OS === 'web') {
    return 0.85; // Higher quality on web (usually WiFi)
  }
  return 0.75; // More aggressive compression on mobile
}

/**
 * Upload image to Supabase Storage and return the public URL
 */
export async function uploadImageToSupabase(
  uri: string,
  bucket: string = 'dog-photos',
  folder: string = 'uploads'
): Promise<string> {
  try {
    console.log('Starting image upload to Supabase:', uri);
    
    // Get Supabase client (you'll need to pass this or create it here)
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase configuration not found');
    }
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // First optimize the image
    const optimizedImage = await optimizeImage(uri, 'profile');
    
    // Generate unique filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const fileExtension = 'jpg'; // We're converting to JPEG in optimization
    const fileName = `${folder}/${timestamp}-${randomId}.${fileExtension}`;
    
    let fileData: string | ArrayBuffer;
    
    if (Platform.OS === 'web') {
      // For web, fetch the blob and convert to ArrayBuffer
      const response = await fetch(optimizedImage.uri);
      fileData = await response.arrayBuffer();
    } else {
      // For mobile, read the file as base64 and convert to ArrayBuffer
      const base64 = await FileSystem.readAsStringAsync(optimizedImage.uri, {
        encoding: 'base64',
      });
      
      // Convert base64 to ArrayBuffer
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      fileData = bytes.buffer;
    }
    
    console.log('Uploading file to Supabase Storage:', fileName);
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, fileData, {
        contentType: 'image/jpeg',
        upsert: false, // Don't overwrite existing files
      });
    
    if (error) {
      console.error('Supabase upload error:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }
    
    console.log('Upload successful:', data);
    
    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);
    
    console.log('Public URL generated:', publicUrl);
    return publicUrl;
    
  } catch (error) {
    console.error('Error uploading image to Supabase:', error);
    throw error;
  }
}

/**
 * Upload image with auth token for authenticated uploads
 */
export async function uploadImageToSupabaseAuth(
  uri: string,
  authToken: string,
  bucket: string = 'dog-photos',
  folder: string = 'uploads'
): Promise<string> {
  try {
    console.log('Starting authenticated image upload to Supabase:', uri);
    
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase configuration not found');
    }
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      },
    });
    
    // First optimize the image
    const optimizedImage = await optimizeImage(uri, 'profile');
    
    // Generate unique filename with user context
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const fileExtension = 'jpg';
    const fileName = `${folder}/${timestamp}-${randomId}.${fileExtension}`;
    
    let fileData: string | ArrayBuffer;
    
    if (Platform.OS === 'web') {
      const response = await fetch(optimizedImage.uri);
      fileData = await response.arrayBuffer();
    } else {
      const base64 = await FileSystem.readAsStringAsync(optimizedImage.uri, {
        encoding: 'base64',
      });
      
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      fileData = bytes.buffer;
    }
    
    console.log('Uploading authenticated file to Supabase Storage:', fileName);
    
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, fileData, {
        contentType: 'image/jpeg',
        upsert: false,
      });
    
    if (error) {
      console.error('Supabase authenticated upload error:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }
    
    console.log('Authenticated upload successful:', data);
    
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);
    
    console.log('Public URL generated:', publicUrl);
    return publicUrl;
    
  } catch (error) {
    console.error('Error uploading image to Supabase with auth:', error);
    throw error;
  }
}

/**
 * Delete image from Supabase Storage
 */
export async function deleteImageFromSupabase(
  imageUrl: string,
  authToken?: string,
  bucket: string = 'dog-photos'
): Promise<void> {
  try {
    // Extract filename from URL
    const url = new URL(imageUrl);
    const pathParts = url.pathname.split('/');
    const fileName = pathParts.slice(-2).join('/'); // Get folder/filename.ext
    
    console.log('Deleting image from Supabase:', fileName);
    
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase configuration not found');
    }
    
    const supabaseOptions = authToken ? {
      global: {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      },
    } : {};
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, supabaseOptions);
    
    const { error } = await supabase.storage
      .from(bucket)
      .remove([fileName]);
    
    if (error) {
      console.error('Error deleting image from Supabase:', error);
      // Don't throw error for deletion failures, just log them
    } else {
      console.log('Image deleted successfully from Supabase');
    }
  } catch (error) {
    console.error('Error deleting image from Supabase:', error);
    // Don't throw error for deletion failures
  }
}