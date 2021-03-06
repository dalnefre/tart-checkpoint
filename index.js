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
        options.effect = options.newEffect();  // initialize empty effect
        receptionist(message);  // delegate to original receptionist (cause effects)
        options.applyEffect(options.effect);  // add messages sent, if any, to event queue
        options.effect = null;
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
            options.effect = options.newEffect();  // initialize empty effect
            options.processEvent(event);  // accumulate effects caused by event
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
        options.effect = null;
        if (options.effectIsEmpty(effect)) { return callback(false); }
        options.logEffect(effect, function (error) {
            if (error) { return callback(error); }
            options.saveSnapshot(effect, function (error) {
                if (error) { return callback(error); }
                options.applyEffect(effect);
                setImmediate(function () {  // give effects some time to propagate
                    callback(false);
                });
            });
        });
    };

    options.newEffect = options.newEffect || function newEffect() {
        return {
            created: {},
            sent: [],
            output: []
        };
    };
    options.effectIsEmpty = options.effectIsEmpty || function effectIsEmpty(effect) {
        if (!effect) {
            return true;
        }
        if (effect.cause
        ||  effect.exception
        ||  (effect.output.length > 0)
        ||  (effect.sent.length > 0)
        ||  (Object.keys(effect.created).length > 0)) {
            return false;
        }
        return true;
    };
    
    options.logEffect = options.logEffect || function logEffect(effect, callback) {
        console.log(Date.now()+':', effect);
        setImmediate(function () {
            callback(false);
        });
    };

    options.saveSnapshot = options.saveSnapshot || function saveSnapshot(effect, callback) {
        if (effect.exception) { return callback(false); }  // no snapshot on exception
        var snapshot = options.newEffect();
        Object.keys(options.contextMap).forEach(function (token) {
            var context = options.contextMap[token];
            snapshot.created[token] = actorMemento(context);  // make actor mementos
        });
        snapshot.sent = options.eventQueue.slice();  // copy pending events
/**/
        effect.sent.forEach(function (event) {
            snapshot.sent.push(event);  // add new events
        });
        // FIXME: DO WE REALLY WANT TO SNAPSHOT OUTBOUND MESSAGES?
        snapshot.output = effect.output.slice();  // copy new output
/**/
        options.snapshot = snapshot;  // publish snapshot
        options.logSnapshot(snapshot, callback);
    };
    options.logSnapshot = options.logSnapshot || function logSnapshot(snapshot, callback) {
        console.log('snapshot:', snapshot);
        setImmediate(function () {
            callback(false);
        });
    };

    var ignoreBeh = (function () {}).toString();
    options.applySnapshot = options.applySnapshot || function applySnapshot() {
        var effect = options.effect;
        console.log('applySnapshot:', effect);
        options.effect = null;  // suppress effects while restoring snapshot
        if (!options.effectIsEmpty(effect)) {
            // ensure actors exist for each token (allows circular reference)
            Object.keys(effect.created).forEach(function (token) {
                if (!options.contextMap[token]) {
                    options.checkpoint.sponsor(ignoreBeh, {}, token);
                }
            });
            options.applyEffect(effect);
        }
    };
    options.applyEffect = options.applyEffect || function applyEffect(effect) {
        console.log('applyEffect:', effect);
        if (effect.update) {
            // NOTE: In case of exception, this reverts to previous actor state.
            options.updateActor(effect.update);
        }
        if (!effect.exception) {
            Object.keys(effect.created).forEach(function (token) {
                options.updateActor(effect.created[token]);
            });  // FIXME: CONSIDER DOING created UPDATES ONLY IN options.applySnapshot()
            effect.sent.forEach(eventBuffer);  // enqueue sent events
            effect.output.forEach(transport);  // output to original transport
        }
    };
    options.updateActor = options.updateActor || function updateActor(memento) {
        console.log('updateActor:', memento);
        var context = options.contextMap[memento.token];
        context.behavior = memento.behavior;  // update actor behavior
        context.state = domain.decode(memento.state);  // update actor state
    };

    options.addContext = options.addContext || function addContext(context) {
        if (options.effect) {
            var memento = actorMemento(context);
            console.log('addContext:', memento);
            options.effect.created[context.token] = memento;
        }
        return context;
    };
    options.addEvent = options.addEvent || function addEvent(event) {
        if (options.effect) {
            var memento = eventMemento(event);
            console.log('addEvent:', memento);
            options.effect.sent.push(memento);
        }
        return event;
    };
    options.addOutput = options.addOutput || function addOutput(message) {
        if (options.effect) {
            console.log('addOutput:', message);
            options.effect.output.push(message);
        }
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
            options.contextMap[token] = context;
            console.log(token+':', context);
            options.addContext(context);
            return actor;
        }
    };

    options.applySnapshot();
    options.effect = options.newEffect();  // initialize empty effect
    setImmediate(function () {  // process effects of inline initialization
        options.saveCheckpoint(options.errorHandler);
    });
    
    return options.checkpoint;
};