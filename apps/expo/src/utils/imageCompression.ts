import * as ImageManipulator from 'expo-image-manipulator';

export interface CompressionOptions {
  maxWidth: number;
  quality: number;
  format?: ImageManipulator.SaveFormat;
}

export class ImageCompressionService {
  /**
   * Compress image for better upload performance
   */
  static async compressImage(
    uri: string, 
    options: CompressionOptions = { maxWidth: 800, quality: 0.6 }
  ): Promise<string> {
    try {
      console.log(`🖼️ Compressing image with maxWidth: ${options.maxWidth}, quality: ${options.quality}`);
      
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: options.maxWidth } }],
        {
          compress: options.quality,
          format: options.format ?? ImageManipulator.SaveFormat.JPEG,
        }
      );

      console.log(`✅ Image compressed successfully: ${uri} -> ${result.uri}`);
      return result.uri;
    } catch (error) {
      console.error('❌ Error compressing image:', error);
      // Return original URI if compression fails
      return uri;
    }
  }

  /**
   * Get default compression options for low network optimization
   */
  static getDefaultCompressionOptions(): CompressionOptions {
    return {
      maxWidth: 800,     // Resize to max 800px width
      quality: 0.6,      // 60% quality for good balance of size/quality
      format: ImageManipulator.SaveFormat.JPEG
    };
  }

  /**
   * Get high compression options for very slow networks
   */
  static getHighCompressionOptions(): CompressionOptions {
    return {
      maxWidth: 600,     // Smaller size for slow networks
      quality: 0.4,      // Lower quality for smaller file size
      format: ImageManipulator.SaveFormat.JPEG
    };
  }
}
