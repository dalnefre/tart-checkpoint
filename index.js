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
    
    options.events = [];  // queue of pending events
    
    var name = options.name || 'checkpoint';
    var sponsor = options.sponsor || tart.minimal();
    var router = marshal.router(sponsor);
    var domain = router.domain(name);
    var receptionist = domain.receptionist;
    domain.receptionist = function checkpointReceptionist(message) {
        console.log('checkpointReceptionist:', message);
        receptionist(message);  // delegate to original receptionist
        options.saveCheckpoint(options.errorHandler);
    };
    var transport = domain.transport;
    domain.transport = function checkpointTransport(message) {
        console.log('checkpointTransport:', message);
        options.effect.output.push(message);  // buffer output messages
    };
    
    var eventBuffer = sponsor((function () {
        var queue = options.events;  // alias event queue
        var bufferReadyBeh = function (event) {
            console.log('bufferReadyBeh:', event);
            if (event !== null) {  // put
                console.log('bufferReadyBeh put:', event);
                eventConsumer(event);
                this.behavior = bufferWaitBeh;
            }
        };
        var bufferWaitBeh = function (event) {
            console.log('bufferWaitBeh:', event);
            if (event === null) {  // take
                console.log('bufferWaitBeh take:', queue);
                if (queue.length) {
                    event = queue.shift();
                    eventConsumer(event);
                } else {
                    this.behavior = bufferReadyBeh;
                }
            } else {  // put
                console.log('bufferWaitBeh put:', event);
                queue.push(event);
            }
        };
        return bufferReadyBeh;
    })());
    var eventConsumer = sponsor((function () {
        var eventConsumerBeh = function consumerBeh(event) {
            console.log('eventConsumerBeh:', event);
            options.processEvent(event);
            options.saveCheckpoint(function (error) {
                options.errorHandler(error);
                // FIXME: WHAT SHOULD WE DO IF CHECKPOINT FAILS?
                eventBuffer(null);  // request next event
            });
        };
        return eventConsumerBeh;
    })());

    options.saveCheckpoint = options.saveCheckpoint || function saveCheckpoint(callback) {
        var effect = options.effect;
        console.log('saveCheckpoint:', effect);
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
            options.applyEffect(effect);
            // Persist global state --- FIXME *** STATE IS NOT STABLE AT THIS POINT ***
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
//        console.log('persistState effect:', effect);
//        console.log('persistState events:', events);
        setImmediate(function () {
            callback(false);
        });
    };

    options.newEffect = options.newEffect || function newEffect() {
        return {
            created: [],
            sent: [],
            output: []
        };
    };
    options.effectIsEmpty = options.effectIsEmpty || function effectIsEmpty(effect) {
        if (effect.event
        ||  effect.exception
        ||  (effect.output.length > 0)
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
    options.applyEffect = options.applyEffect || function applyEffect(effect) {
        console.log('applyEffect:', effect);
        effect.sent.forEach(eventBuffer);  // enqueue sent events
        effect.output.forEach(transport);  // output to original transport
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

    options.effect = options.newEffect();  // initialize empty effect

    options.errorHandler = options.errorHandler || function errorHandler(error) {
        if (error) {
            console.log('FAIL!', error);
        }
    };

    setImmediate(function () {  // prime the pump...
        options.saveCheckpoint(options.errorHandler);
    });
    
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