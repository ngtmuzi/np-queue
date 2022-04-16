import Queue from '../src';

expect.extend({
  toBeWithinRange(received, expect, deviation) {
    const pass = Math.abs(received - expect) < deviation;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${expect} +/-${deviation}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${expect} +/-${deviation}`,
        pass: false,
      };
    }
  },
});

interface CustomMatchers<R = unknown> {
  toBeWithinRange(expect: number, deviation: number): R;
}

declare global {
  namespace jest {
    interface Expect extends CustomMatchers {}
    interface Matchers<R> extends CustomMatchers<R> {}
    interface InverseAsymmetricMatchers extends CustomMatchers {}
  }
}

function delay(value: any, ms = 200) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (value instanceof Error) return reject(value);
      resolve(value);
    }, ms);
  });
}

describe('queue run by order of add', function () {
  const q = new Queue();

  test('use add() method', async function () {
    expect(
      await Promise.all([
        q.add(() => delay(1)),
        q.add(() => delay(2)),
        q.add(() => delay(3)),
      ])
    ).toEqual([1, 2, 3]);
  });

  test('use add() method and take key', async function () {
    expect(
      await Promise.all([
        q.add(() => delay(1), 'key_a'),
        q.add(() => delay(2), 'key_a').catch((err) => err.message),
        q.add(() => delay(3), 'key_b'),
        q.add(() => delay(4), 'key_b').catch((err) => err.message),
        q.add(() => delay(5), 'key_c'),
        q.add(() => delay(6), 'key_d'),
      ])
    ).toEqual([
      1,
      'already has task with same key',
      3,
      'already has task with same key',
      5,
      6,
    ]);
  });

  test('use wrap() method', async function () {
    const wrapFn = q.wrap(delay);
    expect(await Promise.all([wrapFn(4), wrapFn(5), wrapFn(6)])).toEqual([
      4, 5, 6,
    ]);
  });
});

describe('queue run by concurrency', function () {
  test('use add() method, concurrency = 2', function () {
    const q = new Queue({ concurrency: 2 });
    const startTime = Date.now();

    return Promise.all([
      q.add(delay).then(() => Date.now() - startTime),
      q.add(delay).then(() => Date.now() - startTime),
      q.add(delay).then(() => Date.now() - startTime),
      q.add(delay).then(() => Date.now() - startTime),
      q.add(delay).then(() => Date.now() - startTime),
      q.add(delay).then(() => Date.now() - startTime),
      q.add(delay).then(() => Date.now() - startTime),
    ]).then(function (times) {
      const expectTimes = [200, 200, 400, 400, 600, 600, 800];
      times.forEach(function (useTime, index) {
        expect(useTime).toBeWithinRange(expectTimes[index], 10);
      });
    });
  });

  test('use wrap() method, concurrency = 3', function () {
    const q = new Queue({ concurrency: 3 });
    const wrapFn = q.wrap(delay);
    const startTime = Date.now();

    return Promise.all([
      wrapFn(null).then(() => Date.now() - startTime),
      wrapFn(null).then(() => Date.now() - startTime),
      wrapFn(null).then(() => Date.now() - startTime),
      wrapFn(null).then(() => Date.now() - startTime),
      wrapFn(null).then(() => Date.now() - startTime),
      wrapFn(null).then(() => Date.now() - startTime),
      wrapFn(null).then(() => Date.now() - startTime),
    ]).then(function (times) {
      const expectTimes = [200, 200, 200, 400, 400, 400, 600];
      times.forEach(function (useTime, index) {
        expect(useTime).toBeWithinRange(expectTimes[index], 10);
      });
    });
  });
});

describe('pause & resume', function () {
  test('pause, and resume after 1s', function () {
    const q = new Queue({ concurrency: 1 });
    const startTime = Date.now();

    setTimeout(() => q.pause(), 100);

    return Promise.all([
      q.add(delay).then(() => {
        setTimeout(() => q.resume(), 1000);
        return Date.now() - startTime;
      }),
      q.add(async () => {}).then(() => Date.now() - startTime),
      q.add(delay).then(() => Date.now() - startTime),
    ]).then(function (times) {
      const expectTimes = [200, 1200, 1400];
      times.forEach(function (useTime, index) {
        expect(useTime).toBeWithinRange(expectTimes[index], 10);
      });
    });
  });

  test('pause twice and resume twice queue also correctly run', function () {
    const q = new Queue({ concurrency: 2 });
    const startTime = Date.now();

    setTimeout(() => q.pause(), 100);

    return Promise.all([
      q.add(delay).then(() => Date.now() - startTime),
      q.add(delay).then(() => {
        q.pause();
        q.pause();
        setTimeout(() => {
          q.resume();
          q.resume();
        }, 1000);
        return Date.now() - startTime;
      }),
      q.add(async () => {}).then(() => Date.now() - startTime),
      q.add(delay).then(() => Date.now() - startTime),
    ]).then(function (times) {
      const expectTimes = [200, 200, 1200, 1400];
      times.forEach(function (useTime, index) {
        expect(useTime).toBeWithinRange(expectTimes[index], 10);
      });
    });
  });

  test('no pause but call resume() will do nothing', function () {
    const q = new Queue({ concurrency: 2 });
    const startTime = Date.now();

    return Promise.all([
      q.add(delay).then(() => Date.now() - startTime),
      q
        .add(async () => {})
        .then(() => {
          q.resume();
          return Date.now() - startTime;
        }),
      q.add(delay).then(() => Date.now() - startTime),
      q.add(delay).then(() => Date.now() - startTime),
    ]).then(function (times) {
      const expectTimes = [200, 0, 200, 400];
      times.forEach(function (useTime, index) {
        expect(useTime).toBeWithinRange(expectTimes[index], 10);
      });
    });
  });
});

describe('using all() method', function () {
  test("will return all queue's tasks promise", async function () {
    const q = new Queue({ concurrency: 1 });
    const wrap_delay = q.wrap(delay);

    wrap_delay(1);
    wrap_delay(2);
    wrap_delay(3);

    expect(await q.all()).toEqual([1, 2, 3]);
  });
});

describe('change concurrency in runtime', function () {
  test('case A', async function () {
    const startTime = Date.now();
    const q = new Queue({ concurrency: 1 });
    const wrap_delay = q.wrap(delay);

    setTimeout(() => {
      q.concurrency = 3;
    }, 100);

    return Promise.all([
      wrap_delay(1).then(() => Date.now() - startTime),
      wrap_delay(2).then(() => Date.now() - startTime),
      wrap_delay(3).then(() => Date.now() - startTime),
      wrap_delay(4).then(() => Date.now() - startTime),
      wrap_delay(5).then(() => Date.now() - startTime),
      wrap_delay(6).then(() => Date.now() - startTime),
      wrap_delay(7).then(() => Date.now() - startTime),
      wrap_delay(8).then(() => Date.now() - startTime),
    ]).then((times) => {
      const expectTimes = [200, 300, 300, 400, 500, 500, 600, 700];
      times.forEach(function (useTime, index) {
        expect(useTime).toBeWithinRange(expectTimes[index], 10);
      });
    });
  });

  test('case B', async function () {
    const startTime = Date.now();
    const q = new Queue({ concurrency: 3 });
    const wrap_delay = q.wrap(delay);

    setTimeout(() => {
      q.concurrency = 1;
    }, 100);

    setTimeout(() => {
      q.concurrency = 2;
    }, 1100);

    return Promise.all([
      wrap_delay(1).then(() => Date.now() - startTime),
      wrap_delay(2).then(() => Date.now() - startTime),
      wrap_delay(3).then(() => Date.now() - startTime),
      wrap_delay(4).then(() => Date.now() - startTime),
      wrap_delay(5).then(() => Date.now() - startTime),
      wrap_delay(6).then(() => Date.now() - startTime),
      wrap_delay(7).then(() => Date.now() - startTime),
      wrap_delay(8).then(() => Date.now() - startTime),
      wrap_delay(9).then(() => Date.now() - startTime),
      wrap_delay(10).then(() => Date.now() - startTime),
      wrap_delay(11).then(() => Date.now() - startTime),
    ]).then((times) => {
      const expectTimes = [
        200, 200, 200, 400, 600, 800, 1000, 1200, 1300, 1400, 1500,
      ];
      times.forEach(function (useTime, index) {
        expect(useTime).toBeWithinRange(expectTimes[index], 10);
      });

      expect(q.concurrency).toEqual(2);
    });
  });
});
