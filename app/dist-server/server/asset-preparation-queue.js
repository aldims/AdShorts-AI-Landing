import { env } from "./env.js";
import { logServerEvent } from "./logger.js";
const removeTaskFromQueue = (queue, task) => {
    const index = queue.indexOf(task);
    if (index >= 0) {
        queue.splice(index, 1);
    }
};
export const createAssetPreparationQueue = (options) => {
    if (env.redisUrl) {
        logServerEvent("warn", "asset-queue.redis-fallback", {
            queue: options.name,
            redisUrlConfigured: true,
        });
    }
    const interactiveQueue = [];
    const backgroundQueue = [];
    const inFlightTasks = new Map();
    let activeInteractiveCount = 0;
    let activeBackgroundCount = 0;
    const flush = () => {
        while (activeInteractiveCount < options.interactiveConcurrency &&
            interactiveQueue.length > 0) {
            const nextTask = interactiveQueue.shift();
            if (!nextTask) {
                break;
            }
            activeInteractiveCount += 1;
            nextTask.run();
        }
        while (activeBackgroundCount < options.backgroundConcurrency &&
            backgroundQueue.length > 0 &&
            interactiveQueue.length === 0) {
            const nextTask = backgroundQueue.shift();
            if (!nextTask) {
                break;
            }
            activeBackgroundCount += 1;
            nextTask.run();
        }
    };
    const promoteToInteractive = (task) => {
        if (task.started || task.priority === "interactive") {
            return;
        }
        removeTaskFromQueue(backgroundQueue, task);
        task.priority = "interactive";
        interactiveQueue.push(task);
        flush();
    };
    const createTask = (cacheKey, priority, work) => {
        let resolveTask;
        let rejectTask;
        const promise = new Promise((resolve, reject) => {
            resolveTask = resolve;
            rejectTask = reject;
        });
        const task = {
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
                    }
                    else {
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
            }
            else {
                backgroundQueue.push(task);
            }
            flush();
            return task.promise;
        },
    };
};
