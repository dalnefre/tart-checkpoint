# tart-checkpoint

Checkpointing configuration implementation for [Tiny Actor Run-Time in JavaScript](https://github.com/organix/tartjs).

## Contributors

[@dalnefre](https://github.com/dalnefre), [@tristanls](https://github.com/tristanls)

## Overview

Checkpointing configuration implementation for [Tiny Actor Run-Time in JavaScript](https://github.com/organix/tartjs).

  * [Usage](#usage)
  * [Tests](#tests)
  * [Documentation](#documentation)
  * [Sources](#sources)

## Usage

To run the below example run:

    npm run readme

```javascript
"use strict";

var tart = require('../index.js');

var checkpoint = tart.checkpoint();

var oneTimeBeh = "function oneTimeBeh(message) {"
+ "    var actor = this.sponsor(this.state.createdBeh);" // create
+ "    actor('foo');" // send
+ "    this.behavior = this.state.becomeBeh;" // become
+ "}";

var oneTimeState = {
    createdBeh: "function createdBeh(message) {}",
    becomeBeh: "function becomeBeh(message) {}"
};

var actor = checkpoint.sponsor(oneTimeBeh, oneTimeState);
actor('bar');

```

## Tests

    npm test

## Documentation

### Events

An `event` is an abstraction around the concept of a `message` being delivered to the actor. 
It is a tuple of a `message` and `context`. 
When an `event` is dispatched, the actor `context` is bound to `this`  
and the `context.behavior` is executed with the `message` as a parameter. 
The result of processing the `message` is an `effect`.

An `event` has the following attributes:

  * `context`: _Object_ Actor context the message was delivered to.
  * `message`: _Any_ Message that was delivered.

### Effects

An `effect` is an _Object_ that is the _effect_ of dispatching an `event`. It has the following attributes:

  * `became`: _Function_ _(Default: undefined)_ `function (message) {}` If the actor changed its behavior as a result of processing a `message`, the new behavior it became is referenced here.
  * `behavior`: _Function_ _(Default: undefined)_ `function (message) {}` The behavior that executed to cause this `effect`, if any.
  * `created`: _Array_ An array of created contexts. A context is the execution context of an actor behavior (the value of _this_ when the behavior executes).
  * `event`: _Object_ _(Default: undefined)_ The event that is the cause of this `effect`, if any.
  * `exception`: _Error_ _(Default: undefined)_ If dispatching the `event` caused an exception, that exception is stored here.
  * `sent`: _Array_ An array of `events` that represent messages sent by the actor as a result of processing a `message`.

**Public API**

  * [tart.checkpoint(\[options\])](#tartcheckpointoptions)
  * [checkpoint.dispatch()](#checkpointdispatch)
  * [checkpoint.eventLoop(\[control\])](#checkpointeventloopcontrol)
  * [checkpoint.sponsor(behavior)](#checkpointsponsorbehavior)

### tart.checkpoint(options)

  * `options`: _Object_ _(Default: undefined)_ Optional overrides.  
      WARNING: Implementation of `enqueue` and `dequeue` are tightly coupled and should be overridden together.
    * `constructConfig`: _Function_ _(Default: `function (options) {}`)_ `function (options) {}` 
        Configuration creation function that is given `options`. 
        It should return a capability `function (behavior) {}` to create new actors.
    * `enqueue`: _Function_ `function (eventQueue, events){}` 
        Function that enqueues the new `events` onto the `eventQueue` in place, causing side-effects 
        _(Example: `function (eventQueue, events){ Array.prototype.push.apply(eventQueue, events); }`)_.
    * `dequeue`: _Function_ `function (eventQueue){}` 
        Function that returns next event to be dispatched given an `eventQueue` 
        _(Example: `function (eventQueue){ return eventQueue.shift(); }`)_.
  * Return: _Object_ The checkpoint control object.
    * `dispatch`: _Function_ `function () {}` 
        Function to call in order to dispatch a single event.
    * `eventLoop`: _Function_ `function ([control]) {}` 
        Function to call in order to dispatch multiple events.
    * `effect`: _Object_ Accumulated effects from current step.
    * `sponsor`: _Function_ `function (behavior) {}` 
        A capability to create new actors.

Create a checkpoint control object.

### checkpoint.dispatch()

  * Return: _Effect_ or `false`. 
      Effect of dispatching the next `event` or `false` if no events exists for dispatch.

Dispatch the next `event`.

```javascript
var tart = require('tart-checkpoint');
var checkpoint = tart.checkpoint();

var effect = checkpoint.effect;
console.dir(effect);
while ((effect = checkpoint.dispatch()) !== false) {
    console.dir(effect);
}
```

### checkpoint.eventLoop([control])

  * `control`: _Object_ _(Default: `undefined`)_ Optional overrides.
    * `count`: _Number_ _(Default: `undefined`)_ Maximum number of events to dispatch, or unlimited if `undefined`.
    * `fail`: _Function_ `function (exception) {}` 
        Function called to report exceptions thrown from an actor behavior. Exceptions are thrown by default. _(Example: `function (exception) {/*ignore exceptions*/}`)_.
    * `log`: _Function_ `function (effect) {}` 
        Function called with every effect resulting from an event dispatch.
  * Return: _Boolean_ `true` if event queue is exhausted, `false` otherwise.

Dispatch events in a manner provided by `control`. 

By default, calling `checkpoint.eventLoop()` with no parameters dispatches all events in the event queue.

```javascript
var tart = require('tart-checkpoint');
var checkpoint = tart.checkpoint();

var actor = checkpoint.sponsor(function (message) {
    console.log(message); 
});
actor('foo');
actor('bar');
actor('baz');

checkpoint.eventLoop();
// foo
// bar
// baz
```

### checkpoint.sponsor(behavior)

  * `behavior`: _Function_ `function (message) {}` Actor behavior to invoke every time an actor receives a message.
  * Return: _Function_ `function (message) {}` Actor reference in form of a capability that can be invoked to send the actor a message.

Creates a new actor and returns the actor reference in form of a capability to send that actor a message.

```javascript
var tart = require('tart-checkpoint');
var checkpoint = tart.checkpoint();
var actor = checkpoint.sponsor(function (message) {
    console.log('got message', message);
    console.log(this.self);
    console.log(this.behavior);
    console.log(this.sponsor); 
});
```

## Sources

  * [Tiny Actor Run-Time (JavaScript)](https://github.com/organix/tartjs)
