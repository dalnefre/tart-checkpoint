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

    options.processEvent = options.processEvent || function processEvent(event) {
        console.log('processEvent event:', event);
        options.effect.event = event;
        options.effect.behavior = event.context.behavior;
        try {
            event.context.behavior = options.compileBehavior(options.effect.behavior);
            event.context.behavior(event.message);  // execute actor behavior
            options.effect.became = event.context.behavior.toString();
            event.context.behavior = options.effect.became;
        } catch (exception) {
            options.effect.exception = exception;
        }
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
            // If effect is an error, checkpoint is done.
            if (options.effectIsError(effect)) { return callback(false); }
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
        effect.sent.forEach(eventBuffer);  // enqueue sent events
        effect.output.forEach(transport);  // output to original transport
    };

    var actorMemento = function actorMemento(context) {
        return {
            state: domain.encode(context.state),
            behavior: context.behavior,
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

    options.snapshot =  options.snapshot || {
        created: {},
        sent: []
    };
    options.logSnapshot = options.logSnapshot || function logSnapshot(effect, callback) {
        var snapshot = options.snapshot;
        var exception = false;
        try {
            if (effect.event) {  // remove processed event
                var event = snapshot.sent.shift();
                if ((event.domain != effect.event.domain)
                ||  (event.time != effect.event.time)
                ||  (event.seq != effect.event.seq)) {
                    throw new Error('Wrong event!'
                        + ' expect:'+event.domain+':'+event.seq+'@'+event.time
                        + ' actual:'+effect.event.domain+':'+effect.event.seq+'@'+effect.event.time);
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
        if (effect.event) {  // update actor state/behavior
            var context = effect.event.context;
            snapshot.created[context.token] = actorMemento(context);
        }
        Object.keys(effect.created).forEach(function (token) {
            var context = effect.created[token];
            snapshot.created[context.token] = actorMemento(context);
        });
        effect.sent.forEach(function (event) {
            snapshot.sent.push(eventMemento(event));
        });
    };
    var restoreSnapshot = function restoreSnapshot(snapshot) {
        var ignoreBeh = (function () {}).toString();
        var contextMap = {};
        console.log('restoreSnapshot:', snapshot);
        var tokens = Object.keys(snapshot.created);
        tokens.forEach(function (token) {  // create dummy actors
            var actor = options.checkpoint.sponsor(ignoreBeh, {}, token);
            contextMap[token] = options.effect.created[token];
            delete options.effect.created[token];
        });
        tokens.forEach(function (token) {  // overwrite dummy state & behavior
            var context = contextMap[token];
            var memento = snapshot.created[token];
            context.behavior = memento.behavior;
            context.state = domain.decode(memento.state);
            console.log(token+':', context);  // dump restored context to logfile
        });
        snapshot.sent.forEach(function (memento) {
            var event = {
                domain: memento.domain,
                time: memento.time,
                seq: memento.seq,
                message: domain.decode(memento.message),
                context: contextMap[memento.token]
            };
            console.log('event:', event);
            eventBuffer(event);  // re-queue restored event
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
        if (effect.event
        ||  effect.exception
        ||  (effect.output.length > 0)
        ||  (effect.sent.length > 0)
        ||  (Object.keys(effect.created).length > 0)) {
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
    
    options.addContext = options.addContext || function addContext(context) {
        console.log('addContext:', context);
        options.effect.created[token] = context;
        return context;
    };

    options.addEvent = options.addEvent || function addEvent(event) {
        console.log('addEvent:', event);
        options.effect.sent.push(event);
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