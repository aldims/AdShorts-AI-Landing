import { env } from "./env.js";
import { logServerEvent } from "./logger.js";

export type AssetPreparationPriority = "background" | "interactive";

type AssetPreparationTask<T> = {
  priority: AssetPreparationPriority;
  promise: Promise<T>;
  reject: (error: unknown) => void;
  resolve: (value: T) => void;
  run: () => void;
  started: boolean;
};

type AssetPreparationQueueOptions = {
  backgroundConcurrency: number;
  interactiveConcurrency: number;
  name: string;
};

export type AssetPreparationQueue<T> = {
  schedule: (cacheKey: string, priority: AssetPreparationPriority, task: () => Promise<T>) => Promise<T>;
};

const removeTaskFromQueue = <T>(queue: AssetPreparationTask<T>[], task: AssetPreparationTask<T>) => {
  const index = queue.indexOf(task);
  if (index >= 0) {
    queue.splice(index, 1);
  }
};

export const createAssetPreparationQueue = <T>(
  options: AssetPreparationQueueOptions,
): AssetPreparationQueue<T> => {
  if (env.redisUrl) {
    logServerEvent("warn", "asset-queue.redis-fallback", {
      queue: options.name,
      redisUrlConfigured: true,
    });
  }

  const interactiveQueue: AssetPreparationTask<T>[] = [];
  const backgroundQueue: AssetPreparationTask<T>[] = [];
  const inFlightTasks = new Map<string, AssetPreparationTask<T>>();
  let activeInteractiveCount = 0;
  let activeBackgroundCount = 0;

  const flush = () => {
    while (
      activeInteractiveCount < options.interactiveConcurrency &&
      interactiveQueue.length > 0
    ) {
      const nextTask = interactiveQueue.shift();
      if (!nextTask) {
        break;
      }

      activeInteractiveCount += 1;
      nextTask.run();
    }

    while (
      activeBackgroundCount < options.backgroundConcurrency &&
      backgroundQueue.length > 0 &&
      interactiveQueue.length === 0
    ) {
      const nextTask = backgroundQueue.shift();
      if (!nextTask) {
        break;
      }

      activeBackgroundCount += 1;
      nextTask.run();
    }
  };

  const promoteToInteractive = (task: AssetPreparationTask<T>) => {
    if (task.started || task.priority === "interactive") {
      return;
    }

    removeTaskFromQueue(backgroundQueue, task);
    task.priority = "interactive";
    interactiveQueue.push(task);
    flush();
  };

  const createTask = (cacheKey: string, priority: AssetPreparationPriority, work: () => Promise<T>) => {
    let resolveTask!: (value: T) => void;
    let rejectTask!: (error: unknown) => void;
    const promise = new Promise<T>((resolve, reject) => {
      resolveTask = resolve;
      rejectTask = reject;
    });

    const task: AssetPreparationTask<T> = {
      priority,
      promise,
      reject: rejectTask,
      resolve: resolveTask,
      run: () => {
        task.started = true;

        void work()
          .then(task.resolve)
          .catch(task.reject)
          .finally(() => {
            inFlightTasks.delete(cacheKey);

            if (task.priority === "interactive") {
              activeInteractiveCount = Math.max(0, activeInteractiveCount - 1);
            } else {
              activeBackgroundCount = Math.max(0, activeBackgroundCount - 1);
            }

            flush();
          });
      },
      started: false,
    };

    return task;
  };

  return {
    schedule(cacheKey, priority, taskFactory) {
      const existingTask = inFlightTasks.get(cacheKey);
      if (existingTask) {
        if (priority === "interactive") {
          promoteToInteractive(existingTask);
        }

        return existingTask.promise;
      }

      const task = createTask(cacheKey, priority, taskFactory);
      inFlightTasks.set(cacheKey, task);

      if (priority === "interactive") {
        interactiveQueue.push(task);
      } else {
        backgroundQueue.push(task);
      }

      flush();
      return task.promise;
    },
  };
};
