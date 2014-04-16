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

/*
	To dispatch:
		1. Checkpoint.
		2. If queue is empty, dispatch is done.
		3. Dequeue event to dispatch.
		4. Process event.
		5. Checkpoint.
		6. Schedule next dispatch.
		7. Dispatch is done.
	To checkpoint:
		1. If effect is empty, checkpoint is done.
		2. Write effect to log.
		3. If effect is an error, clear effect, checkpoint is done.
		4. Add messages sent, if any, to event queue.
		3. Concurrently:
			a. Persist actors created, if any.
			b. Persist updated event queue.
			c. Update state/behavior, if changed.
		4. Initialize empty effect.
		5. Checkpoint is done.
*/
module.exports.checkpoint = function checkpoint(options) {
    options = options || {};
    
    var dispatchEvent = options.dispatchEvent || function dispatchEvent(callback) {
    	// Checkpoint.
    	saveCheckpoint(function (error) {
			if (error) { return callback(error); }
			// Dequeue event to dispatch.
		    var event = dequeueEvent();
		    // If queue is empty, dispatch is done.
		    if (!event) { return callback(false); }
		    // Process event.
		    processEvent(event);
		    // Checkpoint.
			saveCheckpoint(function (error) {
				if (error) { return callback(error); }
			    // Schedule next dispatch.
			    scheduleDispatch();
			    // Dispatch is done.
			    return callback(false);
			});
    	});
    };

    var saveCheckpoint = options.saveCheckpoint || function saveCheckpoint(callback) {
    	// If effect is empty, checkpoint is done.
		if (effectIsEmpty()) { return callback(false); }
    	// Write effect to log.
		logEffect(function (error) {
			if (error) { return callback(error); }
			// If effect is an error, clear effect, checkpoint is done.
	    	if (effectIsError()) {
				options.effect = newEffect();
	    		return callback(false);
	    	}
	    	// Add messages sent, if any, to event queue.
	    	enqueueEvents();
	    	// Persist global state
			persistState(function (error) {
				if (error) { return callback(error); }
				// Initialize empty effect.
				options.effect = newEffect();
				// Checkpoint is done.
				callback(false);
			});
		});
    };

    var logEffect = options.logEffect || function logEffect(callback) {
    	console.log('logEffect:', options.effect);
    	setImmediate(function () {
    		callback(false);
    	});
    };

    var persistState = options.persistState || function persistState(callback) {
    	console.log('persistState effect:', options.effect);
    	console.log('persistState events:', options.events);
    	setImmediate(function () {
    		callback(false);
    	});
    };

    var newEffect = options.newEffect || function newEffect() {
        return {
            created: [],
            sent: []
        };
    };

    var effectIsEmpty = options.effectIsEmpty || function effectIsEmpty() {
    	if (options.effect.event
    	||  options.effect.exception
    	||  (options.effect.sent.length > 0)
    	||	(options.effect.created.length > 0)) {
    		return false;
    	}
    	return true;
    };

    var effectIsError = options.effectIsError || function effectIsError() {
    	if (options.effect.exception) {
    		return true;
    	}
    	return false;
    };

    var enqueueEvents = options.enqueueEvents || function enqueueEvents() {
        options.events.push(options.effect.sent.slice());  // clone event batch
    };

    var dequeueEvent = options.dequeueEvent || function dequeueEvent() {
        while (options.events.length > 0) {
            var batch = options.events[0];
            if (batch.length > 0) {
                return batch.shift();  // return next event
            }
            options.events.shift();
        }
        return false;
    };
    
    var compileBehavior = options.compileBehavior || function compileBehavior(source) {
    	return eval('(' + source + ')');  // must produce a Function
    };

    var processEvent = options.processEvent || function processEvent(event) {
    	console.log('processEvent event:', event);
    	options.effect.event = event;
        try {
            options.effect.behavior = event.context.behavior;
            event.context.behavior = compileBehavior(options.effect.behavior);
            event.context.behavior(event.message);  // execute actor behavior
            options.effect.became = event.context.behavior.toString();
            event.context.behavior = options.effect.became;
        } catch (exception) {
            options.effect.exception = exception;
        }
    	console.log('processEvent effect:', options.effect);
    }

    options.events = [];  // queue of pending events (in effect batches)
    
    options.effect = newEffect();  // initialize empty effect

	var scheduleDispatch = options.scheduleDispatch || function scheduleDispatch() {
		setImmediate(function () {
			dispatchEvent(errorHandler);
		});
	};

    var errorHandler = options.errorHandler || function errorHandler(error) {
    	if (error) {
    		console.log('Error:', error);
    	}
    };

	scheduleDispatch();  // prime the pump...
	
	var name = options.name || 'checkpoint';
	var sponsor = options.sponsor || tart.minimal();
	var transport = options.transport || sponsor(function transport(message) {
		console.log('transport:', message);
	});
	var domain = marshal.domain(name, sponsor, transport);

    options.checkpoint = {
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