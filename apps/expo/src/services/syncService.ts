import { Alert } from "react-native";

import { ImageCompressionService } from "../utils/imageCompression";
import { OfflineQueue, QueuedDogData } from "../utils/offlineQueue";

interface SyncCallbacks {
  getUploadURL: (params: {
    folderName: string;
    contentType: string;
  }) => Promise<any>;
  uploadCapturedDog: (params: any) => Promise<any>;
}

export class SyncService {
  private static issyncing = false;
  private static callbacks: SyncCallbacks | null = null;

  static setCallbacks(callbacks: SyncCallbacks) {
    this.callbacks = callbacks;
  }

  static async syncOfflineData(): Promise<void> {
    if (this.issyncing) {
      console.log("Sync already in progress, skipping...");
      return;
    }

    if (!this.callbacks) {
      console.error("Sync callbacks not set");
      return;
    }

    try {
      this.issyncing = true;
      console.log("Starting offline data sync...");

      const pendingItems = await OfflineQueue.getPendingItems();
      const failedItems = await OfflineQueue.getFailedItems();
      const totalItems = await OfflineQueue.getQueueCount();

      console.log(
        `📊 Queue status: ${totalItems} total, ${pendingItems.length} pending, ${failedItems.length} failed`,
      );

      if (pendingItems.length === 0) {
        console.log("No pending items to sync");
        return;
      }

      console.log(`🔄 Syncing ${pendingItems.length} pending items...`);

      let successCount = 0;
      let failureCount = 0;

      for (const item of pendingItems) {
        try {
          console.log(`🔄 Attempting to sync item: ${item.id}`);
          await this.syncSingleItem(item);
          console.log(
            `✅ Successfully synced item: ${item.id}, removing from queue...`,
          );
          await OfflineQueue.removeFromQueue(item.id);
          console.log(`🗑️ Removed item ${item.id} from queue`);
          successCount++;
        } catch (error) {
          console.error(`❌ Failed to sync item ${item.id}:`, error);
          await OfflineQueue.updateRetryCount(item.id);
          failureCount++;
        }
      }

      if (successCount > 0) {
        Alert.alert(
          "Sync Complete",
          `Successfully uploaded ${successCount} dog${successCount > 1 ? "s" : ""} from offline queue.${failureCount > 0 ? ` ${failureCount} item${failureCount > 1 ? "s" : ""} failed and will retry later.` : ""}`,
          [{ text: "OK" }],
        );
      }

      console.log(
        `Sync completed: ${successCount} success, ${failureCount} failures`,
      );
    } catch (error) {
      console.error("Error during sync:", error);
    } finally {
      this.issyncing = false;
    }
  }

  private static async syncSingleItem(item: QueuedDogData): Promise<void> {
    if (!this.callbacks) {
      throw new Error("Sync callbacks not set");
    }

    try {
      // First upload the image
      const dogImageUrl = await this.uploadImage(item.dogImageUri);

      // Then upload the dog data
      const uploadResult = await this.callbacks.uploadCapturedDog({
        operationTaskId: item.operationTaskId,
        batchId: item.batchId,
        dogImageUrl,
        gender: item.gender,
        location: item.location,
        coordinates: item.coordinates,
        fullAddress: item.fullAddress,
        feederName: item.feederName,
        feederPhoneNumber: item.feederPhoneNumber,
        dogColor: item.dogColor,
      });

      if (!uploadResult.success) {
        throw new Error("Failed to upload dog data to server");
      }
    } catch (error) {
      console.error("Error syncing single item:", error);
      throw error;
    }
  }

  private static async uploadImage(uri: string): Promise<string> {
    if (!this.callbacks) {
      throw new Error("Sync callbacks not set");
    }

    try {
      console.log("🔄 Starting sync upload with compression...");

      // Compress image for sync operations (use higher compression for sync)
      const compressionOptions =
        ImageCompressionService.getHighCompressionOptions();
      const compressedUri = await ImageCompressionService.compressImage(
        uri,
        compressionOptions,
      );

      const extension = compressedUri.split(".").pop()?.toLowerCase() ?? "";
      const contentType = `image/${extension === "jpg" ? "jpeg" : extension}`;

      console.log("📤 Syncing compressed image...");

      // Add timeout for sync operations
      const uploadUrlPromise = this.callbacks.getUploadURL({
        folderName: "captured-dogs",
        contentType,
      });

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error("Network request failed - sync timeout")),
          8000,
        ); // 8 second timeout for sync
      });

      const uploadUrlResponse = await Promise.race([
        uploadUrlPromise,
        timeoutPromise,
      ]);

      if (!uploadUrlResponse.success || !uploadUrlResponse.data?.uploadParams) {
        throw new Error("Failed to get upload URL");
      }

      const response = await fetch(compressedUri);
      const blob = await response.blob();

      console.log(
        `📊 Sync compressed image size: ${blob.size} bytes (quality: ${compressionOptions.quality}, maxWidth: ${compressionOptions.maxWidth})`,
      );

      // Add timeout for image upload too
      const uploadPromise = fetch(uploadUrlResponse.data.uploadParams, {
        method: "PUT",
        body: blob,
        headers: {
          "Content-Type": contentType,
        },
      });

      const uploadTimeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error("Network request failed - upload timeout")),
          15000,
        ); // 15 second timeout for upload
      });

      const uploadResponse = (await Promise.race([
        uploadPromise,
        uploadTimeoutPromise,
      ])) as Response;

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed with status: ${uploadResponse.status}`);
      }

      console.log("✅ Sync upload completed with compression");
      return uploadUrlResponse.data.fileUrl;
    } catch (error) {
      console.error("❌ Error uploading image during sync:", error);
      throw error;
    }
  }

  static async getQueueStatus(): Promise<{
    pendingCount: number;
    failedCount: number;
    totalCount: number;
  }> {
    try {
      const [pendingItems, failedItems] = await Promise.all([
        OfflineQueue.getPendingItems(),
        OfflineQueue.getFailedItems(),
      ]);

      return {
        pendingCount: pendingItems.length,
        failedCount: failedItems.length,
        totalCount: pendingItems.length + failedItems.length,
      };
    } catch (error) {
      console.error("Error getting queue status:", error);
      return { pendingCount: 0, failedCount: 0, totalCount: 0 };
    }
  }
}
