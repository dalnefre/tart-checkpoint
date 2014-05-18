/*

bootstrap.js - restore-from-checkpoint test

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

var tart = require('../index.js');
var fs = require('fs');

var test = module.exports = {};
//test = {};  // FIXME: DISABLE ALL TESTS IN THIS SUITE

var ringBuilderBeh = (function ringBuilderBeh(message) {
    // { seed:actor, m:links, n:cycles, done:actor }
    if (--message.m > 0) {  // FIXME: MESSAGE CONTENTS SHOULD BE IMMUTABLE
        this.state.next = this.sponsor(this.behavior);
        this.state.next(message);
        this.behavior = (function ringLinkBeh(n) {
            this.state.next(n);
        }).toString();
    } else {
        this.state.next = message.seed;
        this.state.done = message.done;
        this.behavior = (function ringLastBeh(n) {
            if (--n > 0) {
                this.state.next(n);
            } else {
                this.state.done(this.state.next);
            }
        }).toString();
        message.seed(message.n);
    }
}).toString();

test['ring counts down and terminates'] = function (test) {
    test.expect(1);
    var checkpoint = tart.checkpoint();

    var sponsor = require('tart').minimal();
    var doneTest = sponsor(function (message) {
        console.log('doneTest:', message);
        test.equal(message, ringProxy);
        test.done();
    });
    var remote = checkpoint.router.domain('remote');

    var doneToken = remote.localToRemote(doneTest);
    var doneProxy = checkpoint.domain.remoteToLocal(doneToken);

    var ring = checkpoint.sponsor(ringBuilderBeh);
    var ringToken = checkpoint.domain.localToRemote(ring);
    var ringProxy = remote.remoteToLocal(ringToken);

    ring({ seed:ring, m:5, n:3, done:doneProxy });
};

var pingPongBeh = (function pingPongBeh(message) {
    this.state.done = message.done;
    this.state.ping = this.sponsor((function pingBeh(count) {
        console.log('pingBeh:', count);
        if (count > 0) {
            this.state.pong(--count);
        } else {
            this.state.done('ping');
        }
    }).toString(), { pong:this.self, done:this.state.done });
    this.behavior = (function pongBeh(count) {
        console.log('pongBeh:', count);
        if (count > 0) {
            this.state.ping(--count);
        } else {
            this.state.done('pong');
        }
    }).toString();
    this.state.ping(message.n);  // start
}).toString();

test['ping/pong generates logfile and snapshots'] = function (test) {
    test.expect(1);
    var sponsor = require('tart').minimal();

    try {
        fs.unlinkSync('./logfile.json');
    } catch (ex) {
        console.log(ex);
    }
    var logger = sponsor(function loggerBeh(message) {
        console.log('logger:', message);
        var data = '';
        data += Date.now() + ':';
        data += JSON.stringify(message.effect) + '\n';
        fs.appendFile('./logfile.json', data, function callback(error) {
            if (error) {
                message.fail(error);
            } else {
                message.ok(message.effect);
            }
        });
    });
    var logSnapshot = function logSnapshotToFile(snapshot, callback) {
        var data = '';
        data += Date.now() + ':';
        data += JSON.stringify(snapshot, null, 2) + '\n';
        fs.writeFile('./snapshot.json', data, callback);
    };
    var checkpoint = tart.checkpoint({
        logger: logger,
        logSnapshot: logSnapshot
    });

    var doneTest = sponsor(function (message) {
        console.log('doneTest:', message);
        test.equal(message, 'pong');
        test.done();
    });
    var remote = checkpoint.router.domain('remote');

    var doneToken = remote.localToRemote(doneTest);
    var doneProxy = checkpoint.domain.remoteToLocal(doneToken);
    
    var seed = checkpoint.sponsor(pingPongBeh);
    seed({ n:3, done:doneProxy });
};

test['ping/pong restored from snapshot'] = function (test) {
    test.expect(1);
    var snapshot = {
        created: {},
        sent: [],
        output: []
    };
    snapshot.created['checkpoint#jDGG+vtP8WcnpvDg7ruuTUjf3gs72Erg3q8NSQIybDi37sjScQzPTkl8'] = {
        state: '{"done":"remote#AHVAavTBXzJG81C00c7NLrNpVUR8+KWswbkkSrKoPkkrPYT00ZLzZaO9","ping":"checkpoint#QxXHBVLOaIdao9gh25zET5JSPdfztRPnT6/ON5cpvmXYllPBvX9g0S15"}',
        behavior: 'function pongBeh(count) {\n        console.log(\'pongBeh:\', count);\n        if (count > 0) {\n            this.state.ping(--count);\n        } else {\n            this.state.done(\'pong\');\n        }\n    }',
        token: 'checkpoint#jDGG+vtP8WcnpvDg7ruuTUjf3gs72Erg3q8NSQIybDi37sjScQzPTkl8'
    };
    snapshot.created['checkpoint#QxXHBVLOaIdao9gh25zET5JSPdfztRPnT6/ON5cpvmXYllPBvX9g0S15'] = {
        state: '{"pong":"checkpoint#jDGG+vtP8WcnpvDg7ruuTUjf3gs72Erg3q8NSQIybDi37sjScQzPTkl8","done":"remote#AHVAavTBXzJG81C00c7NLrNpVUR8+KWswbkkSrKoPkkrPYT00ZLzZaO9"}',
        behavior: 'function pingBeh(count) {\n        console.log(\'pingBeh:\', count);\n        if (count > 0) {\n            this.state.pong(--count);\n        } else {\n            this.state.done(\'ping\');\n        }\n    }',
        token: 'checkpoint#QxXHBVLOaIdao9gh25zET5JSPdfztRPnT6/ON5cpvmXYllPBvX9g0S15'
    };
    snapshot.sent = [
        {
            domain: 'checkpoint',
            time: 1398359346185, 
            seq: 2,
            message: '3',
            token: 'checkpoint#QxXHBVLOaIdao9gh25zET5JSPdfztRPnT6/ON5cpvmXYllPBvX9g0S15'
        }
    ];
    var checkpoint = tart.checkpoint({
        name: 'checkpoint',
        effect: snapshot
    });

    var sponsor = require('tart').minimal();
    var doneTest = sponsor(function (message) {
        console.log('doneTest:', message);
        test.equal(message, 'pong');
        test.done();
    });
    var remote = checkpoint.router.domain('remote');

    var doneToken = 'remote#AHVAavTBXzJG81C00c7NLrNpVUR8+KWswbkkSrKoPkkrPYT00ZLzZaO9';
    remote.bindLocal(doneToken, doneTest);
    
    // NOTE: test should proceed based on restored pending event(s)
};
