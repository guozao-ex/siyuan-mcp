/**
 * Batch Operations Utility
 * 批量操作工具 - 提高批量处理效率
 */

interface BatchResult<T = any> {
  total: number;
  successful: number;
  failed: number;
  results: Array<{ success: boolean; data?: T; error?: string; index: number }>;
  duration: number;
}

interface BatchOptions {
  concurrency?: number;
  stopOnError?: boolean;
  retryFailed?: boolean;
  progressCallback?: (progress: number, total: number) => void;
}

export class BatchOperations {
  private client: any;

  constructor(client: any) {
    this.client = client;
  }

  /**
   * 批量插入块
   */
  async insertBlocksBatch(
    blocks: Array<{
      dataType: 'markdown' | 'dom';
      data: string;
      parentID: string;
      previousID?: string;
    }>,
    options: BatchOptions = {}
  ): Promise<BatchResult> {
    const startTime = Date.now();
    const concurrency = options.concurrency || 5;
    const results: BatchResult['results'] = [];

    const executeTask = async (block: any, index: number) => {
      try {
        const data = await this.client.insertBlock({
          dataType: block.dataType,
          data: block.data,
          parentID: block.parentID,
          previousID: block.previousID
        });

        // 思源的 insertBlock 返回数组（data[0].doOperations[0].id 才是新块 ID）。
        // 这里提炼成 { id } —— 否则调用方（通常是 AI Agent）拿到的是难以使用的
        // 嵌套结构，无法引用刚插入的块。
        const newBlockId = data?.[0]?.doOperations?.[0]?.id;
        results[index] = { success: true, data: newBlockId ? { id: newBlockId } : data, index };

        if (options.progressCallback) {
          options.progressCallback(results.filter(r => r).length, blocks.length);
        }
      } catch (error: any) {
        results[index] = {
          success: false,
          error: error?.message || String(error) || String(error),
          index
        };

        if (options.stopOnError) {
          throw error;
        }
      }
    };

    // 并发执行
    const queue = blocks.map((block, index) => ({ block, index }));
    const workers: Promise<void>[] = [];

    for (let i = 0; i < concurrency; i++) {
      workers.push((async () => {
        while (queue.length > 0) {
          const item = queue.shift();
          if (item) {
            await executeTask(item.block, item.index);
          }
        }
      })());
    }

    try {
      await Promise.all(workers);
    } catch (error: any) {
      if (!options.stopOnError) {
        throw error;
      }
    }

    // 重试失败的任务
    if (options.retryFailed) {
      const failed = results.filter(r => !r.success);
      if (failed.length > 0) {
        // 必须写 stderr：stdio 模式下 stdout 是 MCP 协议专用通道。
        console.error(`Retrying ${failed.length} failed operations...`);
        for (const item of failed) {
          await executeTask(blocks[item.index], item.index);
        }
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return {
      total: blocks.length,
      successful,
      failed,
      results: results.filter(r => r), // 过滤空值
      duration: Date.now() - startTime
    };
  }

  /**
   * 批量更新块
   */
  async updateBlocksBatch(
    updates: Array<{ id: string; dataType: 'markdown' | 'dom'; data: string }>,
    options: BatchOptions = {}
  ): Promise<BatchResult> {
    const startTime = Date.now();
    const results: BatchResult['results'] = [];

    const tasks = updates.map(async (update, index) => {
      try {
        const data = await this.client.updateBlock(update);
        results[index] = { success: true, data, index };
      } catch (error: any) {
        results[index] = { success: false, error: error?.message || String(error), index };
        if (options.stopOnError) throw error;
      }

      if (options.progressCallback) {
        options.progressCallback(index + 1, updates.length);
      }
    });

    // 控制并发
    const concurrency = options.concurrency || 5;
    for (let i = 0; i < tasks.length; i += concurrency) {
      await Promise.all(tasks.slice(i, i + concurrency));
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return {
      total: updates.length,
      successful,
      failed,
      results,
      duration: Date.now() - startTime
    };
  }

  /**
   * 批量设置块属性
   */
  async setBlockAttrsBatch(
    updates: Array<{ id: string; attrs: Record<string, string> }>,
    options: BatchOptions = {}
  ): Promise<BatchResult> {
    const startTime = Date.now();
    const results: BatchResult['results'] = [];

    const tasks = updates.map(async (update, index) => {
      try {
        // ⚠️ 签名是**两个参数**：setBlockAttrs(id, attrs)。
        // 这里曾经把整个对象 { id, attrs } 当成第一个参数传进去，于是
        // id 变成了对象、attrs 变成 undefined，思源收到非法参数后写入静默失败，
        // 而本方法仍标记为 success —— 属于"报告成功但实际没做"的缺陷。
        await this.client.setBlockAttrs(update.id, update.attrs);
        results[index] = { success: true, index };
      } catch (error: any) {
        results[index] = { success: false, error: error?.message || String(error), index };
        if (options.stopOnError) throw error;
      }

      if (options.progressCallback) {
        options.progressCallback(index + 1, updates.length);
      }
    });

    const concurrency = options.concurrency || 10; // 属性更新可以更高并发
    for (let i = 0; i < tasks.length; i += concurrency) {
      await Promise.all(tasks.slice(i, i + concurrency));
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return {
      total: updates.length,
      successful,
      failed,
      results,
      duration: Date.now() - startTime
    };
  }

  /**
   * 批量删除块
   */
  async deleteBlocksBatch(
    blockIds: string[],
    options: BatchOptions = {}
  ): Promise<BatchResult> {
    const startTime = Date.now();
    const results: BatchResult['results'] = [];

    const tasks = blockIds.map(async (id, index) => {
      try {
        await this.client.deleteBlock({ id });
        results[index] = { success: true, index };
      } catch (error: any) {
        results[index] = { success: false, error: error?.message || String(error), index };
        if (options.stopOnError) throw error;
      }

      if (options.progressCallback) {
        options.progressCallback(index + 1, blockIds.length);
      }
    });

    const concurrency = options.concurrency || 5;
    for (let i = 0; i < tasks.length; i += concurrency) {
      await Promise.all(tasks.slice(i, i + concurrency));
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return {
      total: blockIds.length,
      successful,
      failed,
      results,
      duration: Date.now() - startTime
    };
  }

  /**
   * 智能批量操作 - 自动选择最优策略
   */
  async smartBatch<T>(
    items: T[],
    operation: (item: T) => Promise<any>,
    options: BatchOptions & {
      estimatedTimePerItem?: number; // 每项预计耗时（ms）
      adaptiveConcurrency?: boolean; // 自适应并发
    } = {}
  ): Promise<BatchResult> {
    const startTime = Date.now();

    // 根据任务数量和预计耗时动态调整并发
    let concurrency = options.concurrency || 5;

    if (options.adaptiveConcurrency) {
      const estimatedTime = options.estimatedTimePerItem || 100;
      const totalEstimatedTime = items.length * estimatedTime;

      // 如果总时间很长，增加并发
      if (totalEstimatedTime > 30000) { // 超过30秒
        concurrency = Math.min(10, Math.ceil(items.length / 10));
      }
    }

    const results: BatchResult['results'] = [];
    const queue = items.map((item, index) => ({ item, index }));

    // 动态监控并调整
    let completedCount = 0;
    let avgTime = 0;

    const executeTask = async (item: T, index: number) => {
      const taskStart = Date.now();

      try {
        const data = await operation(item);
        const taskDuration = Date.now() - taskStart;

        // 更新平均时间
        avgTime = (avgTime * completedCount + taskDuration) / (completedCount + 1);
        completedCount++;

        results[index] = { success: true, data, index };

        if (options.progressCallback) {
          options.progressCallback(completedCount, items.length);
        }
      } catch (error: any) {
        results[index] = { success: false, error: error?.message || String(error), index };

        if (options.stopOnError) {
          throw error;
        }
      }
    };

    // 并发执行
    const workers: Promise<void>[] = [];

    for (let i = 0; i < concurrency; i++) {
      workers.push((async () => {
        while (queue.length > 0) {
          const item = queue.shift();
          if (item) {
            await executeTask(item.item, item.index);
          }
        }
      })());
    }

    try {
      await Promise.all(workers);
    } catch (error: any) {
      if (options.stopOnError) {
        throw error;
      }
    }

    const successful = results.filter(r => r?.success).length;
    const failed = results.filter(r => r && !r.success).length;

    return {
      total: items.length,
      successful,
      failed,
      results: results.filter(r => r),
      duration: Date.now() - startTime
    };
  }

  /**
   * 事务性批量操作（全成功或全失败）
   */
  async transactionalBatch<T>(
    items: T[],
    operation: (item: T) => Promise<any>,
    rollback: (item: T, result: any) => Promise<void>
  ): Promise<BatchResult> {
    const startTime = Date.now();
    const results: BatchResult['results'] = [];
    const successfulOperations: Array<{ item: T; result: any; index: number }> = [];

    try {
      // 依次执行所有操作
      for (let i = 0; i < items.length; i++) {
        try {
          const result = await operation(items[i]);
          results[i] = { success: true, data: result, index: i };
          successfulOperations.push({ item: items[i], result, index: i });
        } catch (error: any) {
          // 发生错误，回滚之前的操作
          console.error(`Transaction failed at item ${i}, rolling back...`);

          for (const op of successfulOperations.reverse()) {
            try {
              await rollback(op.item, op.result);
            } catch (rollbackError) {
              console.error(`Rollback failed for item ${op.index}:`, rollbackError);
            }
          }

          throw new Error(`Transaction aborted at item ${i}: ${error?.message || String(error)}`);
        }
      }

      // 全部成功
      return {
        total: items.length,
        successful: items.length,
        failed: 0,
        results,
        duration: Date.now() - startTime
      };
    } catch (error: any) {
      return {
        total: items.length,
        successful: 0,
        failed: items.length,
        results: [{
          success: false,
          error: error?.message || String(error),
          index: -1
        }],
        duration: Date.now() - startTime
      };
    }
  }
}

/**
 * 批量操作进度跟踪器
 */
export class BatchProgressTracker {
  private total: number;
  private completed: number = 0;
  private failed: number = 0;
  private startTime: number;
  private callbacks: Array<(progress: BatchProgress) => void> = [];

  constructor(total: number) {
    this.total = total;
    this.startTime = Date.now();
  }

  update(success: boolean): void {
    this.completed++;
    if (!success) this.failed++;

    const progress = this.getProgress();
    this.callbacks.forEach(cb => cb(progress));
  }

  getProgress(): BatchProgress {
    const elapsed = Date.now() - this.startTime;
    const rate = this.completed / (elapsed / 1000); // items per second
    const remaining = this.total - this.completed;
    const eta = remaining / rate;

    return {
      total: this.total,
      completed: this.completed,
      failed: this.failed,
      percentage: Math.round((this.completed / this.total) * 100),
      elapsed,
      eta: Math.round(eta * 1000),
      rate: Math.round(rate * 100) / 100
    };
  }

  onProgress(callback: (progress: BatchProgress) => void): void {
    this.callbacks.push(callback);
  }
}

interface BatchProgress {
  total: number;
  completed: number;
  failed: number;
  percentage: number;
  elapsed: number;
  eta: number;
  rate: number;
}
