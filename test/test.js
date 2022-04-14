"use strict";
const chai           = require("chai");
const chaiAsPromised = require("chai-as-promised");
const assert         = chai.assert;
chai.use(chaiAsPromised);
chai.should();

const Queue = require('../built/index');

const delay = (value, ms = 200) =>
  new Promise(resolve => {
    setTimeout(() => resolve(value), ms);
  });

describe('queue run by order of add', function () {
  const q = new Queue();

  it('use add() method', function () {
    return Promise.all([
      q.add(() => delay(1)),
      q.add(() => delay(2)),
      q.add(() => delay(3))
    ])
      .should.eventually.deep.equal([1, 2, 3]);
  });

  it('use add() method and take key', function () {
    return Promise.all([
      q.add(() => delay(1), 'key_a'),
      q.add(() => delay(2), 'key_a').catch(err => err.message),
      q.add(() => delay(3), 'key_b'),
      q.add(() => delay(4), 'key_b').catch(err => err.message),
      q.add(() => delay(5), 'key_c'),
      q.add(() => delay(6), 'key_d')
    ])
      .should.eventually.deep.equal([1, 'already has task with same key', 3, 'already has task with same key', 5, 6]);
  });

  it('use wrap() method', function () {
    const wrapFn = q.wrap(delay);
    return Promise.all([
      wrapFn(4),
      wrapFn(5),
      wrapFn(6)
    ])
      .should.eventually.deep.equal([4, 5, 6]);
  });

});


describe('queue run by concurrency', function () {


  it('use add() method, concurrency = 2', function () {
    const q         = new Queue({concurrency: 2});
    const startTime = new Date();

    return Promise.all([
      q.add(delay).then(() => new Date() - startTime),
      q.add(delay).then(() => new Date() - startTime),
      q.add(delay).then(() => new Date() - startTime),
      q.add(delay).then(() => new Date() - startTime),
      q.add(delay).then(() => new Date() - startTime),
      q.add(delay).then(() => new Date() - startTime),
      q.add(delay).then(() => new Date() - startTime),
    ])
      .then(function (times) {
        const expectTimes = [200, 200, 400, 400, 600, 600, 800];
        times.forEach(function (useTime, index) {
          assert.closeTo(useTime, expectTimes[index], 10, 'useTime are close');
        })
      });

  });

  it('use wrap() method, concurrency = 3', function () {
    const q         = new Queue({concurrency: 3});
    const wrapFn    = q.wrap(delay);
    const startTime = new Date();

    return Promise.all([
      wrapFn().then(() => new Date() - startTime),
      wrapFn().then(() => new Date() - startTime),
      wrapFn().then(() => new Date() - startTime),
      wrapFn().then(() => new Date() - startTime),
      wrapFn().then(() => new Date() - startTime),
      wrapFn().then(() => new Date() - startTime),
      wrapFn().then(() => new Date() - startTime),
    ])
      .then(function (times) {
        const expectTimes = [200, 200, 200, 400, 400, 400, 600];
        times.forEach(function (useTime, index) {
          assert.closeTo(useTime, expectTimes[index], 10, 'useTime are close');
        })
      });

  });
});


describe('pause & resume', function () {

  it('pause, and resume after 1s', function () {
    const q         = new Queue({concurrency: 1});
    const startTime = new Date();

    return Promise.all([
      q.add(delay).then(() => {
        q.pause();
        setTimeout(() => q.resume(), 1000);
        return new Date() - startTime;
      }),
      q.add(() => {}).then(() => new Date() - startTime),
      q.add(delay).then(() => new Date() - startTime)
    ])
      .then(function (times) {
        const expectTimes = [200, 1200, 1400];
        times.forEach(function (useTime, index) {
          assert.closeTo(useTime, expectTimes[index], 10, 'useTime are close');
        })
      });
  });


  it('pause, and resume after 1s, finished promise will waiting queue resume', function () {
    const q         = new Queue({concurrency: 2});
    const startTime = new Date();

    return Promise.all([
      q.add(delay).then(() => new Date() - startTime),
      q.add(() => {}).then(() => {
        q.pause();
        setTimeout(() => q.resume(), 1000);
        return new Date() - startTime;
      }),
      q.add(() => {}).then(() => new Date() - startTime),
      q.add(delay).then(() => new Date() - startTime)
    ])
      .then(function (times) {
        const expectTimes = [1000, 0, 1000, 1200];
        times.forEach(function (useTime, index) {
          assert.closeTo(useTime, expectTimes[index], 10, 'useTime are close');
        })
      });
  });


  it('pause twice and resume twice queue also correctly run', function () {
    const q         = new Queue({concurrency: 2});
    const startTime = new Date();

    return Promise.all([
      q.add(delay).then(() => new Date() - startTime),
      q.add(() => {}).then(() => {
        q.pause();
        q.pause();
        setTimeout(() => {
          q.resume();
          q.resume();
        }, 1000);
        return new Date() - startTime;
      }),
      q.add(() => {}).then(() => new Date() - startTime),
      q.add(delay).then(() => new Date() - startTime)
    ])
      .then(function (times) {
        const expectTimes = [1000, 0, 1000, 1200];
        times.forEach(function (useTime, index) {
          assert.closeTo(useTime, expectTimes[index], 10, 'useTime are close');
        })
      });
  });


  it('no pause but call resume() will do nothing', function () {
    const q         = new Queue({concurrency: 2});
    const startTime = new Date();

    return Promise.all([
      q.add(delay).then(() => new Date() - startTime),
      q.add(() => {}).then(() => {
        q.resume();
        return new Date() - startTime;
      }),
      q.add(delay).then(() => new Date() - startTime),
      q.add(delay).then(() => new Date() - startTime)
    ])
      .then(function (times) {
        const expectTimes = [200, 0, 200, 400];
        times.forEach(function (useTime, index) {
          assert.closeTo(useTime, expectTimes[index], 10, 'useTime are close');
        })
      });
  });

});