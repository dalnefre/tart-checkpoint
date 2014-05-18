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

var oneTimeBeh = (function oneTimeBeh(message) {
    console.log('oneTimeBeh:', message);
    var becomeBeh = (function becomeBeh(message) {}).toString();
    var actor = this.sponsor((function createdBeh(message) {
        console.log('createdBeh:', message);
    }).toString()); // create
    actor(this.state.label); // send
    this.behavior = becomeBeh; // become
}).toString();

var actor = checkpoint.sponsor(oneTimeBeh, { label:'foo' });
actor('bar');

```

## Tests

    npm test

## Documentation

Checkpoint objects are intended to be safely convertible to JSON and back again without loss of information.

### Events

An `event` is an _Object_ that represents a _message_ sent to an _actor_.

An `event` has the following attributes:
  * `domain`: _String_ URI identifying the domain that generated the event.
  * `time`: _Number_ `Date.now()` timestamp when the event was generated.
  * `seq`: _Number_ event sequence number, monotonically increasing within `time`.
  * `message`: _String_ Transport-encoded message to be delivered.
  * `token`: _String_ Transport token identifying the target actor.

### Actors

An `actor` is an _Object_ that represents a unique entity with _state_ and _behavior_.

An `actor` has the following attributes:
  * `state`: _String_ Transport-encoded object representing the actor's state.
  * `behavior`: _String_ The actor's behavior function in source form.
  * `token`: _String_ Transport token uniquely identifying this actor.

### Effects

An `effect` is an _Object_ that represents the result of processing an _event_.

An `effect` has the following attributes:
  * `created`: _Object_ _(Default: {})_ A map from tokens to newly-created `actors`.
  * `sent`: _Array_ _(Default: [])_ An array of `events` representing newly-sent _messages_.
  * `output`: _Array_ _(Default: [])_ An array of transport-encoded messages to remote actors.
  * `cause`: _Object_ _(Default: undefined)_ The `event` that is the cause of this `effect`, if any.
  * `update`: _Object_ _(Default: undefined)_ The new _state_ and _behavior_ of the `actor` that was the target of this `event`.
  * `exception`: _Object_ _(Default: undefined)_ If dispatching the `event` caused an exception, that exception is stored here.

**Public API**

  * [tart.checkpoint(\[options\])](#tartcheckpointoptions)

### tart.checkpoint(options)

  * `options`: _Object_ _(Default: undefined)_ Optional overrides.
    * `logger`: _Actor_ `function (message) {}`  Record effects
      * `message`: _Object_ ...
        * `effect`: _Object_ The `effect` to record.
        * `ok`: _Actor_ On success, send `effect` here.
        * `fail`: _Actor_ On failure, send `error` here.
  * Return: _Object_ The checkpoint control object.
    * `domain`: _Object_ Marshal domain.
    * `router`: _Object_ Router for marshal domain.
    * `sponsor`: _Function_ `function (behavior[, state[, token]]) {}` 
        A capability to create new actors with persistent state and optional identity.

Create a checkpoint control object.

## Sources

  * [Tiny Actor Run-Time (JavaScript)](https://github.com/organix/tartjs)
