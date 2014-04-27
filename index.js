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
    
    options.eventQueue = [];  // queue of pending event mementos
    options.contextMap = {};  // map from tokens to actor contexts
    
    var name = options.name || 'checkpoint';
    var sponsor = options.sponsor || tart.minimal();
    var router = marshal.router();
    var domain = router.domain(name);
    var receptionist = domain.receptionist;
    domain.receptionist = function checkpointReceptionist(message) {
        console.log('checkpointReceptionist:', message);
        receptionist(message);  // delegate to original receptionist (cause effects)
        options.applyEffect(options.effect);  // Add messages sent, if any, to event queue.
        snapshotEffect(options.effect);  // FIXME: FIND A BETTER WAY TO CAPTURE SNAPSHOT
        options.effect = options.newEffect();  // Initialize empty effect.
    };
    var transport = domain.transport;
    domain.transport = function checkpointTransport(message) {
        console.log('checkpointTransport:', message);
        options.addOutput(message);  // buffer output messages
    };
    
    var eventBuffer = sponsor((function () {
        var queue = options.eventQueue;  // alias event queue
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

    options.processEvent = options.processEvent || function processEvent(event) {
        console.log('processEvent event:', event);
        options.effect.cause = event;
        var context = options.contextMap[event.token];
        console.log('processEvent context:', context);
        var memento = actorMemento(context);  // capture initial state & behavior
        try {
            var message = domain.decode(event.message);
            console.log('processEvent message:', message);
            var behavior = context.behavior;
            console.log('processEvent behavior:', behavior);
            context.behavior = options.compileBehavior(behavior);
            context.behavior(message);  // execute actor behavior
            memento = actorMemento(context);  // capture final state & behavior
        } catch (exception) {
            options.effect.exception = exception;
        }
        options.effect.update = memento;
        console.log('processEvent effect:', options.effect);
    }
    options.compileBehavior = options.compileBehavior || function compileBehavior(source) {
        return eval('(' + source + ')');  // must produce a Function
    };

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
            // Add messages sent, if any, to event queue.
            options.applyEffect(effect);
            // Checkpoint is done.
            return callback(false);
        });
    };

    options.logEffect = options.logEffect || function logEffect(effect, callback) {
        var json = domain.encode(effect);
        console.log('logEffect:', json);
        options.logSnapshot(effect, callback);
    };

    options.applyEffect = options.applyEffect || function applyEffect(effect) {
        console.log('applyEffect:', effect);
        if (effect.update) {
            var memento = effect.update;
            var context = options.contextMap[memento.token];
            context.behavior = memento.behavior;  // update actor behavior
            context.state = domain.decode(memento.state);  // update actor state
        }
        if (!effect.exception) {
            Object.keys(effect.created).forEach(function (token) {
                var memento = effect.created[token];
                // FIXME: RE-CREATE ACTOR FROM MEMENTO?
            });
            effect.sent.forEach(eventBuffer);  // enqueue sent events
            effect.output.forEach(transport);  // output to original transport
        }
    };

    options.snapshot =  options.snapshot || {
        created: {},
        sent: []
    };
    options.logSnapshot = options.logSnapshot || function logSnapshot(effect, callback) {
        var snapshot = options.snapshot;
        var exception = false;
        try {
            if (effect.cause) {  // remove processed event
                var memento = snapshot.sent.shift();
                if ((memento.domain != effect.cause.domain)
                ||  (memento.time != effect.cause.time)
                ||  (memento.seq != effect.cause.seq)) {
                    throw new Error('Wrong event!'
                        + ' expect:'+memento.domain+':'+memento.seq+'@'+memento.time
                        + ' actual:'+effect.cause.domain+':'+effect.cause.seq+'@'+effect.cause.time);
                }
                // FIXME: RESTORE IN-MEMORY STATE ON EXCEPTION?
            }
            snapshotEffect(effect);
            console.log('snapshot:', snapshot);
        } catch (ex) {
            exception = ex;
        }
        setImmediate(function () {
            callback(exception);
        });
    };
    var snapshotEffect = function snapshotEffect(effect) {
        var snapshot = options.snapshot;
        console.log('snapshotEffect:', effect);
        if (effect.update) {  // update actor state/behavior
            snapshot.created[effect.update.token] = effect.update;
        }
        Object.keys(effect.created).forEach(function (token) {
            snapshot.created[token] = effect.created[token];
        });
        effect.sent.forEach(function (memento) {
            snapshot.sent.push(memento);
        });
    };
    var restoreSnapshot = function restoreSnapshot(snapshot) {
        var ignoreBeh = (function () {}).toString();
        console.log('restoreSnapshot:', snapshot);
        var tokens = Object.keys(snapshot.created);
        tokens.forEach(function (token) {  // create dummy actors
            var actor = options.checkpoint.sponsor(ignoreBeh, {}, token);
            delete options.effect.created[token];
        });
        tokens.forEach(function (token) {  // overwrite dummy state & behavior
            var context = options.contextMap[token];
            var memento = snapshot.created[token];
            context.behavior = memento.behavior;
            context.state = domain.decode(memento.state);
            console.log(token+':', context);  // dump restored context to logfile
        });
        snapshot.sent.forEach(eventBuffer);  // re-queue restored events
    };

    options.newEffect = options.newEffect || function newEffect() {
        return {
            created: {},
            sent: [],
            output: []
        };
    };
    options.effectIsEmpty = options.effectIsEmpty || function effectIsEmpty(effect) {
        if (effect.cause
        ||  effect.exception
        ||  (effect.output.length > 0)
        ||  (effect.sent.length > 0)
        ||  (Object.keys(effect.created).length > 0)) {
            return false;
        }
        return true;
    };
    
    options.addContext = options.addContext || function addContext(context) {
        console.log('addContext:', context);
        options.contextMap[context.token] = context;
        options.effect.created[context.token] = actorMemento(context);
        return context;
    };
    options.addEvent = options.addEvent || function addEvent(event) {
        console.log('addEvent:', event);
        options.effect.sent.push(eventMemento(event));
        return event;
    };
    options.addOutput = options.addOutput || function addOutput(message) {
        console.log('addOutput:', message);
        options.effect.output.push(message);
        return message;
    };

    options.errorHandler = options.errorHandler || function errorHandler(error) {
        if (error) {
            console.log('FAIL!', error);
        }
    };

    var actorMemento = function actorMemento(context) {
        return {
            state: domain.encode(context.state),
            behavior: context.behavior.toString(),
            token: context.token
        };
    };
    var eventMemento = function eventMemento(event) {
        return {
            domain: domain.name,
            time: event.time,
            seq: event.seq,
            message: domain.encode(event.message),
            token: event.context.token
        };
    };

    var eventSeq = 0;
    options.checkpoint = {
        router: router,
        domain: domain,
        sponsor: function create(behavior, state, token) {
            state = state || {};
            var actor = function send(message) {
                var event = {
                    domain: domain.name,
                    time: Date.now(),
                    seq: ++eventSeq,
                    message: message,
                    context: context
                };
                options.addEvent(event);
            };
            if (token) {
                domain.bindLocal(token, actor);
            } else {
                token = domain.localToRemote(actor);
            }
            var context = {
                self: actor,
                token: token,
                state: state,
                behavior: behavior.toString(),
                sponsor: create
            };
            options.addContext(context);
            return actor;
        }
    };

    options.effect = options.newEffect();  // initialize empty effect
    restoreSnapshot(options.snapshot);
    setImmediate(function () {  // prime the pump...
        options.saveCheckpoint(options.errorHandler);
    });
    
    return options.checkpoint;
};