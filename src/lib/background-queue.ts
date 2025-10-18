/**
 * Background Task Queue System
 * Manages background processes with dependencies
 */

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface BackgroundTask {
  id: string;
  type: 'process_a' | 'process_b' | 'process_c';
  status: TaskStatus;
  displayName: string;
  subjectId?: string;
  error?: string;
  dependsOn?: string; // Task ID this task depends on
  result?: any; // Store result from execution for dependent tasks
  execute: () => Promise<void>;
}

export interface QueueState {
  tasks: BackgroundTask[];
  currentTask: BackgroundTask | null;
}

class BackgroundQueue {
  private tasks: BackgroundTask[] = [];
  private currentTask: BackgroundTask | null = null;
  private listeners: Set<(state: QueueState) => void> = new Set();
  private isProcessing = false;

  /**
   * Subscribe to queue state changes
   */
  subscribe(listener: (state: QueueState) => void): () => void {
    this.listeners.add(listener);
    // Immediately notify with current state
    listener(this.getState());
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get current queue state
   */
  getState(): QueueState {
    return {
      tasks: [...this.tasks],
      currentTask: this.currentTask,
    };
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners() {
    const state = this.getState();
    this.listeners.forEach(listener => listener(state));
  }

  /**
   * Add a task to the queue
   */
  addTask(task: BackgroundTask) {
    this.tasks.push(task);
    this.notifyListeners();
    this.processQueue();
  }

  /**
   * Remove a completed or failed task from the queue
   */
  removeTask(taskId: string) {
    this.tasks = this.tasks.filter(t => t.id !== taskId);
    this.notifyListeners();
  }

  /**
   * Process the next available task in the queue
   */
  private async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (true) {
      // Find next task that can be executed
      const nextTask = this.tasks.find(task => {
        if (task.status !== 'pending') return false;

        // Check if dependency is satisfied
        if (task.dependsOn) {
          const dependency = this.tasks.find(t => t.id === task.dependsOn);
          if (!dependency || dependency.status !== 'completed') {
            return false;
          }
        }

        return true;
      });

      if (!nextTask) break;

      // Execute the task
      this.currentTask = nextTask;
      nextTask.status = 'running';
      this.notifyListeners();

      try {
        await nextTask.execute();
        nextTask.status = 'completed';
      } catch (error) {
        nextTask.status = 'failed';
        nextTask.error = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Task ${nextTask.id} failed:`, error);
      }

      this.currentTask = null;
      this.notifyListeners();

      // Auto-remove completed tasks after a delay
      if (nextTask.status === 'completed') {
        setTimeout(() => {
          this.removeTask(nextTask.id);
        }, 3000);
      }
    }

    this.isProcessing = false;
  }

  /**
   * Get the currently active task (Process A or Process B)
   */
  getCurrentTask(): BackgroundTask | null {
    return this.currentTask;
  }

  /**
   * Get all tasks
   */
  getTasks(): BackgroundTask[] {
    return [...this.tasks];
  }

  /**
   * Get a task by ID
   */
  getTaskById(taskId: string): BackgroundTask | undefined {
    return this.tasks.find(t => t.id === taskId);
  }

  /**
   * Clear all tasks (useful for debugging)
   */
  clearAll() {
    this.tasks = [];
    this.currentTask = null;
    this.notifyListeners();
  }
}

// Singleton instance
export const backgroundQueue = new BackgroundQueue();
