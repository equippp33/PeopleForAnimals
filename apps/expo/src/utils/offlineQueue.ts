import AsyncStorage from "@react-native-async-storage/async-storage";

export interface QueuedDogData {
  id: string;
  operationTaskId: string;
  batchId: string;
  dogImageUri: string; // Local URI
  gender: string;
  location?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  fullAddress?: string;
  feederName?: string;
  feederPhoneNumber?: string;
  dogColor: string;
  timestamp: number;
  retryCount: number;
}

const QUEUE_STORAGE_KEY = "offline_dog_queue";
const MAX_RETRY_COUNT = Infinity; // Infinite retries

export class OfflineQueue {
  static async addToQueue(
    dogData: Omit<QueuedDogData, "id" | "timestamp" | "retryCount">,
  ): Promise<string> {
    try {
      const queue = await this.getQueue();
      const id = `dog_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const queueItem: QueuedDogData = {
        ...dogData,
        id,
        timestamp: Date.now(),
        retryCount: 0,
      };

      queue.push(queueItem);
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));

      console.log("Added dog to offline queue:", id);
      return id;
    } catch (error) {
      console.error("Error adding to offline queue:", error);
      throw error;
    }
  }

  static async getQueue(): Promise<QueuedDogData[]> {
    try {
      const queueData = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
      return queueData ? (JSON.parse(queueData) as QueuedDogData[]) : [];
    } catch (error) {
      console.error("Error getting offline queue:", error);
      return [];
    }
  }

  static async removeFromQueue(id: string): Promise<void> {
    try {
      const queue = await this.getQueue();
      const updatedQueue = queue.filter((item) => item.id !== id);
      await AsyncStorage.setItem(
        QUEUE_STORAGE_KEY,
        JSON.stringify(updatedQueue),
      );
      console.log(`Removed item ${id} from offline queue`);
    } catch (error) {
      console.error("Error removing item from queue:", error);
      throw error;
    }
  }

  static async deleteFromQueue(id: string): Promise<void> {
    try {
      const queue = await this.getQueue();
      const updatedQueue = queue.filter((item) => item.id !== id);
      await AsyncStorage.setItem(
        QUEUE_STORAGE_KEY,
        JSON.stringify(updatedQueue),
      );
      console.log(`Manually deleted item ${id} from offline queue`);
    } catch (error) {
      console.error("Error deleting item from queue:", error);
      throw error;
    }
  }

  static async updateRetryCount(id: string): Promise<void> {
    try {
      const queue = await this.getQueue();
      const itemIndex = queue.findIndex((item) => item.id === id);

      if (itemIndex !== -1 && queue[itemIndex]) {
        queue[itemIndex]!.retryCount += 1;
        await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
        console.log(
          `Updated retry count for ${id}: ${queue[itemIndex]!.retryCount}`,
        );
      }
    } catch (error) {
      console.error("Error updating retry count:", error);
      throw error;
    }
  }

  static async getQueueCount(): Promise<number> {
    try {
      const queue = await this.getQueue();
      return queue.length;
    } catch (error) {
      console.error("Error getting queue count:", error);
      return 0;
    }
  }

  static async clearQueue(): Promise<void> {
    try {
      await AsyncStorage.removeItem(QUEUE_STORAGE_KEY);
      console.log("Cleared offline queue");
    } catch (error) {
      console.error("Error clearing offline queue:", error);
      throw error;
    }
  }

  static async getFailedItems(): Promise<QueuedDogData[]> {
    try {
      const queue = await this.getQueue();
      return queue.filter((item) => item.retryCount >= MAX_RETRY_COUNT);
    } catch (error) {
      console.error("Error getting failed items:", error);
      return [];
    }
  }

  static async getPendingItems(): Promise<QueuedDogData[]> {
    try {
      const queue = await this.getQueue();
      return queue.filter((item) => item.retryCount < MAX_RETRY_COUNT);
    } catch (error) {
      console.error("Error getting pending items:", error);
      return [];
    }
  }

  static async resetFailedItems(): Promise<number> {
    try {
      const queue = await this.getQueue();
      let resetCount = 0;

      const updatedQueue = queue.map((item) => {
        if (item.retryCount >= MAX_RETRY_COUNT) {
          resetCount++;
          return { ...item, retryCount: 0 };
        }
        return item;
      });

      await AsyncStorage.setItem(
        QUEUE_STORAGE_KEY,
        JSON.stringify(updatedQueue),
      );
      console.log(`Reset ${resetCount} failed items to retry`);
      return resetCount;
    } catch (error) {
      console.error("Error resetting failed items:", error);
      return 0;
    }
  }
}
