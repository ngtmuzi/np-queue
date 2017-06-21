/**
 * @link https://ngtmuzi.github.io/实现一个简单的promise队列
 */
"use strict";

/**
 * Promise Queue
 */
class Queue {
  /**
   * 构造函数
   * @param {Promise} promiseLibrary  允许自定义Promise库，默认使用全局Promise
   * @param {Number} concurrency      并发数，默认1
   */
  constructor({promiseLibrary, concurrency} = {}) {
    this.concurrency = isNaN(+concurrency) ? 1 : +concurrency;
    this.queue       = [];
    this.runCount    = 0;
    this.Promise     = promiseLibrary || Promise;
    this._wait       = this.Promise.resolve();
  }

  /**
   * 添加一个待执行函数到队列
   * @param {Function} fn 通常来说返回一个Promise
   * @returns {Promise} 返回fn执行完成后的Promise
   */
  add(fn) {
    return new this.Promise((resolve, reject) => {
      this.queue.push(() =>
        this._wait
          .then(fn)
          .then(value => this._wait.then(() => value))
          .then(resolve, reject)
      );
      this._consume();
    });
  }

  /**
   * 内部函数，用于启动队列中的Promise任务
   */
  _consume() {
    while (this.runCount < this.concurrency && this.queue.length) {
      this.runCount++;

      this.queue.shift()()
        .then(() => {
          this.runCount--;
          this._consume();
        });
    }
  }

  /**
   * 暂停队列运行，注意已完成的fn结果也会被挂起直到resume()
   */
  pause() {
    if (this._isPausing) return;

    this._isPausing = true;
    this._wait      = new this.Promise((resolve) => {
      this._waitForResume = () => {
        this._isPausing = false;
        resolve();
      };
    });
  }

  /**
   * 恢复队列运行
   */
  resume() {
    if (typeof this._waitForResume === 'function') this._waitForResume();
    this._consume();
  }

  /**
   * 用该队列包裹一个函数，返回一个“仅运行指定并发数的函数”
   * @param {Function} fn
   * @param {Object} thisArg  fn的运行上下文，选填
   * @returns {Function} warpFn
   */
  warp(fn, thisArg) {
    const self   = this;
    const warpFn = function () {
      return self.add(fn.bind(thisArg, ...arguments));
    };
    warpFn.queue = this;

    return warpFn;
  }
}

module.exports = Queue;