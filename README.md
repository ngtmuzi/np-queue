# np-queue
[![Build Status](https://www.travis-ci.org/ngtmuzi/np-queue.svg?branch=master)](https://www.travis-ci.org/ngtmuzi/np-queue)
[![Coverage Status](https://coveralls.io/repos/github/ngtmuzi/np-queue/badge.svg?branch=master)](https://coveralls.io/github/ngtmuzi/np-queue?branch=master)

**[中文文档](https://github.com/ngtmuzi/np-queue/wiki/%E4%B8%AD%E6%96%87%E6%96%87%E6%A1%A3)**  
A queue to control Promise task's concurrency and pause/resume.

## Install

```
npm i np-queue
```

## Usage

```javascript
import Queue from 'np-queue';
const q = new Queue();
const delay = (value) =>  
  new Promise(resolve => {
    setTimeout(() => resolve(value), 1000);  
  });

q.add(()=>delay(1)).then(console.log);
q.add(()=>delay(2)).then(console.log);

const delay_wrap = q.wrap(delay);

delay_wrap(3).then(console.log);
delay_wrap(4).then(console.log);
```
You will see it output 1,2,3,4 interval by 1 seconds.

**NOTE: if in `async` function, you should not use `await` keyword, otherwise it will be running by "serial" because `add()` return a promise.**

## API

### `new Queue({concurrency})`

#### `concurrency`
Limit how much Promise task can concurrency run, default is 1.

### `queue.add(fn,[key])`

#### fn
The async function you define, it return a `Promise` or anything, note it will not receive any arguments so you must wrap your arguments in its code.

#### key
The task key you define, can use any type except `undefined`, if you give one key that already exist in queue, `add()` will return a rejection `Promise`. 

### `queue.wrap(fn, [thisArg])`

It will be return a function that wrap the `fn`, use the queue's concurrency to limit how much `fn` can be execute on same time.
 
For example, you can fast define one function it only can serial execute:

```javascript
const serial_fn = new Queue().wrap(fn);
```

On many time it's useful.

### `queue.pause()` & `queue.resume()`

Pause/resume this queue, no more word.

### `queue.all()`

like `Promise.all`, waiting all queue's tasks promise be done, notice it may not sort by running order.

### `queue.concurrency`

get/set queue's concurrency.

## Test
```
npm run test
```
