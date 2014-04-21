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
  * `created`: _Array_ _(Default: [])_ An array of created contexts. A context is the execution context of an actor behavior (the value of _this_ when the behavior executes).
  * `event`: _Object_ _(Default: undefined)_ The event that is the cause of this `effect`, if any.
  * `exception`: _Error_ _(Default: undefined)_ If dispatching the `event` caused an exception, that exception is stored here.
  * `sent`: _Array_ _(Default: [])_ An array of `events` that represent messages sent by the actor as a result of processing a `message`.
  * `output`: _Array_ _(Default: [])_ An array of transport-encoded remote-messages sent by the actor as a result of processing a `message`.

**Public API**

  * [tart.checkpoint(\[options\])](#tartcheckpointoptions)

### tart.checkpoint(options)

  * `options`: _Object_ _(Default: undefined)_ Optional overrides.  
    * `logEffect`: _Function_ `function (effect, callback) {}` 
        Record `effect`, then call `callback(error)`.
  * Return: _Object_ The checkpoint control object.
    * `router`: _Object_ Router for checkpoint/marshal domain.
    * `domain`: _Object_ Marshal domain.
    * `sponsor`: _Function_ `function (behavior[, state]) {}` 
        A capability to create new actors with persistent state.

Create a checkpoint control object.

## Sources

  * [Tiny Actor Run-Time (JavaScript)](https://github.com/organix/tartjs)
