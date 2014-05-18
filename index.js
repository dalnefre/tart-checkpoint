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

    options.currentEvent = null;
    options.eventQueue = [];  // queue of pending event mementos
    options.contextMap = {};  // map from tokens to actor contexts
    
//    var sponsor = options.sponsor || tart.minimal();
    var router = marshal.router();
    var domain = router.domain(options.name);
    var receptionist = domain.receptionist;
    domain.receptionist = function checkpointReceptionist(message) {
        console.log('checkpointReceptionist:', message);
        options.effect = options.newEffect();  // initialize empty effect
        receptionist(message);  // delegate to original receptionist (cause effects)
        options.applyEffect(options.effect);  // add messages sent, if any, to event queue
        options.effect = null;
        options.schedule();  // try to dispatch next event
    };
    var transport = domain.transport;
    domain.transport = function checkpointTransport(message) {
        console.log('checkpointTransport:', message);
        options.addOutput(message);  // buffer output messages
    };
    
    options.schedule = options.schedule || function schedule() {
        if (!options.currentEvent) {  // no event in progress, try to dispatch one
            if (options.eventQueue.length > 0) {
                options.currentEvent = options.dequeueEvent();
                options.dispatch();  // asynchronous event dispatch
            }
        }
    };
    options.dequeueEvent = options.dequeueEvent || function dequeueEvent() {
        return options.eventQueue.shift();
    };
    options.enqueueEvents = options.enqueueEvents || function enqueueEvents(events) {
        events.forEach(function (event) {
            options.eventQueue.push(event);
        });
    };
    options.removeEvent = options.removeEvent || function removeEvent(event) {
        var i = 0;
        while (i < options.eventQueue.length) {
            var event_i = options.eventQueue[i];
            if ((event_i.domain === event.domain)
            &&  (event_i.time === event.time)
            &&  (event_i.seq === event.seq)) {
                options.eventQueue.splice(i, 1);  // remove matching event
                return;
            }
            ++i;
        }
    };
    options.dispatch = options.dispatch || function dispatch() {
        var event = options.currentEvent;
        console.log('dispatch:', event);
        setImmediate(function () {
            options.effect = options.newEffect();  // initialize empty effect
            options.processEvent(event);  // accumulate effects caused by event
            var effect = options.effect;  // capture effects
            options.effect = null;  // clear effect collector
            options.saveCheckpoint(effect, function (error) {
                options.errorHandler(error);
                // FIXME: WHAT SHOULD WE DO IF CHECKPOINT FAILS?
                options.currentEvent = null;  // done with this event
                options.schedule();  // request next event, if any
            });
        });
    }

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
            // remove newly-created actors
            Object.keys(options.effect.created).forEach(function (token) {
                delete options.contextMap[token];
            });
        }
        options.effect.update = memento;
        console.log('processEvent effect:', options.effect);
    }
    options.compileBehavior = options.compileBehavior || function compileBehavior(source) {
        return eval('(' + source + ')');  // must produce a Function
    };

    options.saveCheckpoint = options.saveCheckpoint || function saveCheckpoint(effect, callback) {
        console.log('saveCheckpoint:', effect);
        if (options.effectIsEmpty(effect)) { return callback(false); }
        options.logger({
            effect: effect,
            ok: function (effect) {
                options.applyEffect(effect);
                options.saveSnapshot(effect, callback);
            },
            fail: function (error) {
                callback(error);
            }
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
    
    options.logger = options.logger || function logger(message) {  // FIXME: should be an actor?
        var effect = message.effect;
        console.log(Date.now()+':', effect);
        message.ok(effect);
    };

    options.saveSnapshot = options.saveSnapshot || function saveSnapshot(effect, callback) {
        if (effect.exception) { return callback(false); }  // no snapshot on exception
        var snapshot = options.newEffect();
        Object.keys(options.contextMap).forEach(function (token) {
            var context = options.contextMap[token];
            snapshot.created[token] = actorMemento(context);  // make actor mementos
        });
        snapshot.sent = options.eventQueue.slice();  // copy pending events
/*
        // FIXME: DO WE REALLY WANT TO SNAPSHOT OUTBOUND MESSAGES?
        snapshot.output = effect.output.slice();  // copy new output
*/
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
            if (effect.cause) {  // remove causal event from queue
                options.removeEvent(effect.cause);
            }
            // ensure actors exist for each token (allows circular reference)
            Object.keys(effect.created).forEach(function (token) {
                if (!options.contextMap[token]) {
                    options.checkpoint.sponsor(ignoreBeh, {}, token);
                }
            });
            // re-create actor state and behavior
            Object.keys(effect.created).forEach(function (token) {
                options.updateActor(effect.created[token]);
            });
            // apply remaining effects (such as queueing events)
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
            options.enqueueEvents(effect.sent);  // enqueue sent events
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

    options.preInit = options.preInit || function preInit() {
        console.log('preInit: BEGIN');
        options.applySnapshot();
        options.effect = options.newEffect();  // initialize empty effect
        setImmediate(function () {
            options.postInit();  // process effects of inline initialization
        });
        console.log('preInit: END');
    };
    options.postInit = options.postInit || function postInit() {
        console.log('postInit: BEGIN');
        var effect = options.effect;  // capture effects
        options.effect = null;  // clear effect collector
        options.saveCheckpoint(effect, function (error) {
            options.errorHandler(error);
            // FIXME: WHAT SHOULD WE DO IF CHECKPOINT FAILS?
            options.schedule();  // try to dispatch first event
            // FIXME: consider requiring the host to call schedule() after initialization
            console.log('currentEvent:', options.currentEvent);
            console.log('eventQueue:', options.eventQueue);
        });
        console.log('postInit: END');
    };

    options.preInit();
    
    return options.checkpoint;
};