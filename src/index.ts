/**
 * @link https://ngtmuzi.github.io/实现一个简单的promise队列
 */

type AsyncFn<T> = (...args: any[]) => Promise<T>;

/**
 * Promise Queue
 */
class Queue {
  private readonly concurrency: number;
  private readonly queue: AsyncFn<any>[] = [];
  private readonly keySet: Set<any> = new Set();
  private runCount: number = 0;
  private _isPausing: boolean = false;
  private _all_done?: Promise<void>;
  private _all_done_cb?: (...args: any[]) => void;

  /**
   * 构造函数
   * @param {Number} concurrency      并发数，默认1
   */
  constructor(opts?: { concurrency?: number }) {
    this.concurrency = opts?.concurrency || 1;
  }

  /**
   * 添加一个待执行函数到队列
   * @param {Function} fn 通常来说返回一个Promise
   * @param {*}       key 用于区别其他任务的key
   * @returns {Promise} 返回fn执行完成后的Promise
   */
  async add<T>(fn: AsyncFn<T>, key?: any) {
    if (key !== undefined && this.keySet.has(key))
      throw new Error('already has task with same key');

    if (key !== undefined) this.keySet.add(key);

    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          if (key !== undefined) this.keySet.delete(key);
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
      this._consume();
    });
  }

  /**
   * 内部函数，用于启动队列中的Promise任务
   */
  private _consume() {
    if (
      this.runCount === 0 &&
      this.queue.length === 0 &&
      typeof this._all_done_cb === 'function'
    )
      return this._all_done_cb();

    while (
      this.runCount < this.concurrency &&
      this.queue.length &&
      !this._isPausing
    ) {
      this.runCount++;

      this.queue
        .shift()()
        .then(
          () => {
            this.runCount--;
            this._consume();
          },
          () => {}
        );
    }
  }

  /**
   * 暂停队列运行，注意已完成的fn结果也会被挂起直到resume()
   */
  pause() {
    this._isPausing = true;
  }

  /**
   * 恢复队列运行
   */
  resume() {
    this._isPausing = false;
    this._consume();
  }

  /**
   * 用该队列包裹一个函数，返回一个“仅运行指定并发数的函数”
   * @param {Function} fn
   * @param {Object} thisArg  fn的运行上下文，选填
   * @returns {Function} wrapFn
   */
  wrap<F extends AsyncFn<any>>(fn: F, thisArg: any = undefined) {
    const self = this;
    const wrapFn = function (...args: any[]) {
      return self.add(fn.bind(thisArg, ...args));
    } as F & { queue?: Queue };
    wrapFn.queue = this;

    return wrapFn;
  }

  /**
   * waiting for queue all done
   * @returns
   */
  async all() {
    if (this.runCount === 0 && this.queue.length === 0)
      return Promise.resolve();

    if (!(this._all_done instanceof Promise)) {
      this._all_done = new Promise((resolve) => {
        this._all_done_cb = () => {
          this._all_done = null;
          this._all_done_cb = null;
          resolve();
        };
      });
    }

    return this._all_done;
  }
}

export = Queue;
