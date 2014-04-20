/*

index.js - "tart-checkpoint": Checkpointing configuration implementation

The MIT License (MIT)

Copyright (c) 2013 Dale Schumacher, Tristan Slominski

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.

*/
"use strict";

var tart = require('tart');
var marshal = require('tart-marshal');

module.exports.checkpoint = function checkpoint(options) {
    options = options || {};
    
    var name = options.name || 'checkpoint';
    var sponsor = options.sponsor || tart.minimal();
    var router = marshal.router(sponsor);
    var domain = router.domain(name);
    var receptionist = domain.receptionist;
    domain.receptionist = function checkpointReceptionist(message) {
        console.log('checkpointReceptionist:', message);
        receptionist(message);  // delegate to original receptionist
        options.scheduleDispatch();  // trigger checkpoint scheduler
    };
    var transport = domain.transport;
    domain.transport = function checkpointTransport(message) {
        console.log('checkpointTransport:', message);
        transport(message);  // delegate to original transport
    };
    
    var eventBuffer = sponsor((function () {
        var queue = []; //options.events;  // alias event queue
        var bufferReadyBeh = function (event) {
            if (event !== eventConsumer) {  // put
                eventConsumer(event);
                this.behavior = bufferWaitBeh;
            }
        };
        var bufferWaitBeh = function (event) {
            if (event === eventConsumer) {  // take
                if (queue.length) {
                    event = queue.shift();
                    eventConsumer(event);
                } else {
                    this.behavior = bufferReadyBeh;
                }
            } else {  // put
                queue.push(event);
            }
        };
        return bufferReadyBeh;
    })());
    var eventConsumer = sponsor((function () {
        var eventConsumerBeh = function consumerBeh(event) {
            options.processEvent(message.event);
            eventBuffer(this.self);
        };
        return eventConsumerBeh;
    })());

    options.dispatchEvent = options.dispatchEvent || function dispatchEvent(callback) {
        // Checkpoint.
        options.saveCheckpoint(function (error) {
            if (error) { return callback(error); }
            // Dequeue event to dispatch.
            var event = options.dequeueEvent();
            // If queue is empty, dispatch is done.
            if (!event) { return callback(false); }
            // Process event.
            options.processEvent(event);
            // Checkpoint.
            options.saveCheckpoint(function (error) {
                if (error) { return callback(error); }
                // Schedule next dispatch.
                options.scheduleDispatch();
                // Dispatch is done.
                return callback(false);
            });
        });
    };

    options.saveCheckpoint = options.saveCheckpoint || function saveCheckpoint(callback) {
        var effect = options.effect;
        // If effect is empty, checkpoint is done.
        if (options.effectIsEmpty(effect)) { return callback(false); }
        // Initialize empty effect.
        options.effect = options.newEffect();
        // Write effect to log.
        options.logEffect(effect, function (error) {
            if (error) { return callback(error); }
            // If effect is an error, checkpoint is done.
            if (options.effectIsError(effect)) { return callback(false); }
            // Add messages sent, if any, to event queue.
            options.enqueueEvents(effect.sent);
            // Persist global state
            options.persistState(effect, options.events, callback);
        });
    };

    options.logEffect = options.logEffect || function logEffect(effect, callback) {
        var json = domain.encode(effect);
        console.log('logEffect:', json);
        setImmediate(function () {
            callback(false);
        });
    };

    options.persistState = options.persistState || function persistState(effect, events, callback) {
        console.log('persistState effect:', effect);
        console.log('persistState events:', events);
        setImmediate(function () {
            callback(false);
        });
    };

    options.newEffect = options.newEffect || function newEffect() {
        return {
            created: [],
            sent: []
        };
    };

    options.effectIsEmpty = options.effectIsEmpty || function effectIsEmpty(effect) {
        if (effect.event
        ||  effect.exception
        ||  (effect.sent.length > 0)
        ||  (effect.created.length > 0)) {
            return false;
        }
        return true;
    };

    options.effectIsError = options.effectIsError || function effectIsError(effect) {
        if (effect.exception) {
            return true;
        }
        return false;
    };

    options.enqueueEvents = options.enqueueEvents || function enqueueEvents(events) {
        options.events.push(events.slice());  // clone event batch
    };

    options.dequeueEvent = options.dequeueEvent || function dequeueEvent() {
        while (options.events.length > 0) {
            var batch = options.events[0];
            if (batch.length > 0) {
                return batch.shift();  // return next event
            }
            options.events.shift();
        }
        return false;
    };
    
    options.compileBehavior = options.compileBehavior || function compileBehavior(source) {
        return eval('(' + source + ')');  // must produce a Function
    };

    options.processEvent = options.processEvent || function processEvent(event) {
        console.log('processEvent event:', event);
        options.effect.event = event;
        try {
            options.effect.behavior = event.context.behavior;
            event.context.behavior = options.compileBehavior(options.effect.behavior);
            event.context.behavior(event.message);  // execute actor behavior
            options.effect.became = event.context.behavior.toString();
            event.context.behavior = options.effect.became;
        } catch (exception) {
            options.effect.exception = exception;
        }
        console.log('processEvent effect:', options.effect);
    }

    options.events = [];  // queue of pending events (in effect batches)
    
    options.effect = options.newEffect();  // initialize empty effect

    options.inDispatch = false;
    options.scheduleDispatch = options.scheduleDispatch || function scheduleDispatch() {
        setImmediate(function () {
            console.log('scheduleDispatch:', options.inDispatch);
            if (options.inDispatch) {
                options.errorHandler(new Error('DISPATCH RE-ENTRY'));
            }
            options.inDispatch = true;
            options.dispatchEvent(function (error) {
                options.inDispatch = false;
                options.errorHandler(error);
            });
        });
    };

    options.errorHandler = options.errorHandler || function errorHandler(error) {
        if (error) {
            console.log('FAIL!', error);
        }
    };

    options.scheduleDispatch();  // prime the pump...
    
    options.checkpoint = {
        router: router,
        domain: domain,
        sponsor: function create(behavior, state) {
            state = state || {};
            var actor = function send(message) {
                var event = {
                    message: message,
                    context: context
                };
                options.effect.sent.push(event);
            };
            var context = {
                self: actor,
                state: state,
                behavior: behavior.toString(),
                sponsor: create
            };
            options.effect.created.push(context);
            return actor;
        }
    };

    return options.checkpoint;
};