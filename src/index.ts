/**
 * @link https://ngtmuzi.github.io/%E5%AE%9E%E7%8E%B0%E4%B8%80%E4%B8%AA%E7%AE%80%E5%8D%95%E7%9A%84promise%E9%98%9F%E5%88%97/
 */

/**
 * Async Function
 */
type AsyncFn<T> = (...args: any[]) => Promise<T>;

/**
 * void function
 */
function voidFn() {}

/**
 * Promise's wrap
 */
class WrapPromise<T> {
  protected resolve: (...args: any[]) => void;
  protected reject: (...args: any[]) => void;
  readonly promise: Promise<T>;

  constructor() {
    this.promise = new Promise<T>((_resolve, _reject) => {
      this.resolve = _resolve;
      this.reject = _reject;
    });
  }
}

/**
 * Queue's item
 */
class QueueItem<T> extends WrapPromise<T> {
  readonly wrapped_fn: AsyncFn<T>;
  readonly key: string | symbol;

  constructor(fn: AsyncFn<T>, key?: string | symbol) {
    super();
    this.key = key || Symbol();

    this.wrapped_fn = () => {
      Promise.resolve().then(fn).then(this.resolve, this.reject);
      return this.promise;
    };
  }
}

/**
 * Promise Queue
 */
class Queue {
  private _concurrency: number;
  private readonly queue: QueueItem<any>[] = [];
  readonly keySet: Set<string | symbol> = new Set();
  readonly runningMap: Map<string | symbol, QueueItem<any>> = new Map();

  private _isPausing: boolean = false;

  /**
   * @param opts.concurrency the concurrency of task run
   */
  constructor(opts?: { concurrency?: number }) {
    this._concurrency = opts?.concurrency || 1;
  }

  /**
   * add a async function to queue, and return an promise
   * @param fn async function, notice it must bind `this` by itself
   * @param key task's unique key, if it duplicate will throw an async error
   * @returns
   */
  async add<T>(fn: AsyncFn<T>, key?: string | symbol) {
    key = key || Symbol();

    if (this.keySet.has(key)) throw new Error('already has task with same key');
    this.keySet.add(key);

    const item = new QueueItem(fn, key);
    this.queue.push(item);

    this._consume();
    return item.promise;
  }

  /**
   * consume task from queue
   */
  private _consume() {
    while (
      this.runningMap.size < this._concurrency &&
      this.queue.length &&
      !this._isPausing
    ) {
      const item = this.queue.shift();
      this.runningMap.set(item.key, item);

      const originPromise = item.wrapped_fn();

      originPromise.catch(voidFn).then(() => {
        this.keySet.delete(item.key);
        this.runningMap.delete(item.key);
        this._consume();
      }, voidFn);
    }
  }

  /**
   * pause the queue's running
   */
  pause() {
    this._isPausing = true;
  }

  /**
   * resume queue's running
   */
  resume() {
    this._isPausing = false;
    this._consume();
  }

  /**
   * wrap the given function, it will be async run using this queue
   * @param fn async function
   * @param thisArg `this` context
   * @returns
   */
  wrap<F extends AsyncFn<any>>(fn: F, thisArg: any = undefined) {
    const wrapFn = ((...args: unknown[]) => {
      return this.add(fn.bind(thisArg, ...args) as F);
    }) as F & { queue?: Queue };
    wrapFn.queue = this;

    return wrapFn;
  }

  /**
   * waiting for queue all done
   * @returns
   */
  async all() {
    const all_promises = [
      ...Array.from(this.runningMap.values()).map((i) => i.promise),
      ...this.queue.map((i) => i.promise),
    ];

    return Promise.all(all_promises);
  }

  /**
   * queue's concurrency
   */
  get concurrency() {
    return this._concurrency;
  }
  set concurrency(n: number) {
    this._concurrency = n;
    if (!this._isPausing) this._consume();
  }
}

export default Queue;
module.exports = Queue;
module.exports.default = Queue;