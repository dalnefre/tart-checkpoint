/*

account.js - checkpoint account test

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

var accountBeh = (function accountBeh(message) {
    console.log('account:', message);
    if (message.type === 'balance') {
        // { type:'balance', ok:, fail: }
        message.ok(this.state.balance);
    } else if (message.type === 'adjust') {
        // { type:'adjust', amount:, ok:, fail: }
        var balance = this.state.balance + message.amount;
        if (balance >= 0) {
            this.state.balance = balance;
            message.ok(this.state.balance);
        } else {
            message.fail({
                error: 'Insufficient Funds',
                account: this.self
            });
        }
    }
}).toString();
var transferBeh = (function transferBeh(message) {
    // { from:, to:, amount:, ok:, fail: }
    var debit = this.sponsor((function debitBeh(message) {
        this.state.from({
            type: 'adjust',
            amount: -(this.state.amount),
            ok: this.self,  // continue
            fail: this.state.fail
        });
        this.behavior = (function creditBeh(message) {
            this.state.to({
                type: 'adjust',
                amount: +(this.state.amount),
                ok: this.state.ok,
                fail: this.self  // continue
            });
            this.behavior = (function reverseBeh(message) {
                this.state.from({
                    type: 'adjust',
                    amount: +(this.state.amount),
                    ok: this.state.fail,
                    fail: this.state.fail
                });
            }).toString();
        }).toString();
    }).toString(), message);
    debit();
}).toString();

test['can check balance of persistent acccount'] = function (test) {
    test.expect(1);
    var checkpoint = tart.checkpoint();
    var sponsor = require('tart').minimal();

    var account = checkpoint.sponsor(accountBeh, { balance: 42 });
/*
    var consoleBeh = (function consoleBeh(message) {
        console.log('console:', message);
    }).toString();
    var consoleLog = checkpoint.sponsor(consoleBeh);
    account({ type: 'balance', ok: consoleLog });
*/
    var remote = checkpoint.router.domain('remote');
    var token = checkpoint.domain.localToRemote(account);
    var proxy = remote.remoteToLocal(token);

    var endTest = sponsor(function (message) {
        console.log('endTest:', message);
        test.done();  // signal test completion
    });
    var failTest = sponsor(function (message) {
        console.log('failTest:', message);
        test.assert(false);  // should not be called
    });
    var expect42 = sponsor(function (message) {
        console.log('expect42:', message);
        test.equal(message, 42);
        endTest();
    });
    proxy({ type: 'balance', ok: expect42, fail: failTest });
};

test['can balance transfer between persistent acccounts'] = function (test) {
    test.expect(2);
    var checkpoint = tart.checkpoint();
    var sponsor = require('tart').minimal();

    var account0 = checkpoint.sponsor(accountBeh, { balance: 0 });
    var account1 = checkpoint.sponsor(accountBeh, { balance: 42 });
    var transAct = checkpoint.sponsor(transferBeh);

    var remote = checkpoint.router.domain('remote');
    var endTest = sponsor(function (message) {
        console.log('endTest:', message);
        test.done();  // signal test completion
    });
    var failTest = sponsor(function (message) {
        console.log('failTest:', message);
        test.assert(false);  // should not be called
    });
    var srcAcct;  // filled in by runTest
    var expect13 = sponsor(function (message) {
        console.log('expect13:', message);
        test.equal(message, 13);
        srcAcct({ type:'balance', ok:expect29, fail:failTest });
    });
    var expect29 = sponsor(function (message) {
        console.log('expect29:', message);
        test.equal(message, 29);
        endTest();
    });
    var runTest = sponsor(function (message) {
        // { trans:, from:, to: }
        srcAcct = message.from;
        message.trans({
            from: message.from,
            to: message.to,
            amount: 13,
            ok: expect13,
            fail: failTest
        });
    });
    
    var token = remote.localToRemote(runTest);
    var proxy = checkpoint.domain.remoteToLocal(token);
    proxy({
        trans: transAct,
        from: account1,
        to: account0
    });
};

test['can check balance of restored acccount'] = function (test) {
    test.expect(1);
    var checkpoint = tart.checkpoint({ name: 'checkpoint' });
    var sponsor = require('tart').minimal();
    
    var token = 'checkpoint#68r3paEw31ozVBvyMNg111706DsRjA2kYV7uuQ7nHCukRTu4wkyWwRdg';
    var object = {};
    object[token] = {
        state: { balance: 42 },
        behavior: accountBeh
    };
    var snapshot = checkpoint.domain.encode(object);
//    fs.writeFileSync('./account42.json', snapshot);
//    var snapshot = '{"state":{"balance":42},"behavior":":function accountBeh(message) {\n    console.log(\'account:\', message);\n    if (message.type === \'balance\') {\n        // { type:\'balance\', ok:, fail: }\n        message.ok(this.state.balance);\n    } else if (message.type === \'adjust\') {\n        // { type:\'adjust\', amount:, ok:, fail: }\n        var balance = this.state.balance + message.amount;\n        if (balance >= 0) {\n            this.state.balance = balance;\n            message.ok(this.state.balance);\n        } else {\n            message.fail({\n                error: \'Insufficient Funds\',\n                account: this.self\n            });\n        }\n    }\n}"}';
    console.log('snapshot:', snapshot);
    var actors = checkpoint.domain.decode(snapshot);
    var context = actors[token];
    var actor = checkpoint.sponsor(context.behavior, context.state, token);

    var remote = checkpoint.router.domain('remote');
    var proxy = remote.remoteToLocal(token);

    var endTest = sponsor(function (message) {
        console.log('endTest:', message);
        test.done();  // signal test completion
    });
    var failTest = sponsor(function (message) {
        console.log('failTest:', message);
        test.assert(false);  // should not be called
    });
    var expect42 = sponsor(function (message) {
        console.log('expect42:', message);
        test.equal(message, 42);
        endTest();
    });
    proxy({ type: 'balance', ok: expect42, fail: failTest });
};

test['can check balance of reloaded acccount'] = function (test) {
    test.expect(1);
    var checkpoint = tart.checkpoint({ name: 'checkpoint' });
    var sponsor = require('tart').minimal();
    
    var token = 'checkpoint#68r3paEw31ozVBvyMNg111706DsRjA2kYV7uuQ7nHCukRTu4wkyWwRdg';
    var snapshot = fs.readFileSync('./account42.json');
    console.log('snapshot:', snapshot);
    var actors = checkpoint.domain.decode(snapshot);
    var context = actors[token];  // FIXME: ITERATE THROUGH KEYS AND CREATE ALL ACTORS
    var actor = checkpoint.sponsor(context.behavior, context.state, token);

    var remote = checkpoint.router.domain('remote');
    var proxy = remote.remoteToLocal(token);

    var endTest = sponsor(function (message) {
        console.log('endTest:', message);
        test.done();  // signal test completion
    });
    var failTest = sponsor(function (message) {
        console.log('failTest:', message);
        test.assert(false);  // should not be called
    });
    var expect42 = sponsor(function (message) {
        console.log('expect42:', message);
        test.equal(message, 42);
        endTest();
    });
    proxy({ type: 'balance', ok: expect42, fail: failTest });
};

test['can see balance transfer in mirrored configuration'] = function (test) {
    test.expect(2);
    var sponsor = require('tart').minimal();
    
    var originalOpt = {
        logger: sponsor(function logger(message) {
            console.log('logger:', message);
            var effect = message.effect;
            mirroredOpt.effect = JSON.parse(JSON.stringify(effect));
            mirroredOpt.applySnapshot();
            mirroredOpt.saveSnapshot(effect, function callback(error) {
                if (error) {
                    message.fail(error);
                } else {
                    message.ok(effect);
                }
            });
        })
    };
    var original = tart.checkpoint(originalOpt);
    var mirroredOpt = {
        schedule: function mirroredSchedule() {
            console.log('mirroredSchedule IGNORED!');
//            process.exit(1);  --- this is called during checkpoint post-initialization
        }
    };
    var mirrored = tart.checkpoint(mirroredOpt);

    var account0 = original.sponsor(accountBeh, { balance: 0 });
    var account1 = original.sponsor(accountBeh, { balance: 42 });
    var transAct = original.sponsor(transferBeh);

    var remote = original.router.domain('remote');
    var endTest = sponsor(function (message) {
        console.log('endTest:', message);
        console.log('originalOpt:', originalOpt);
        console.log('mirroredOpt:', mirroredOpt);
        test.deepEqual(originalOpt.snapshot, mirroredOpt.snapshot);
        test.done();  // signal test completion
    });
    var failTest = sponsor(function (message) {
        console.log('failTest:', message);
        test.assert(false);  // should not be called
    });
    var expect13 = sponsor(function (message) {
        console.log('expect13:', message);
        test.equal(message, 13);
        endTest();
    });
    
    mirrored.router.routingTable['remote'] = function mirroredRoute(message) {
        console.log('mirroredRoute:', message);
    };
    
    var proxy = original.domain.decode(
        remote.encode({
            expect13: expect13,
            failTest: failTest
        })
    );
    transAct({
        from: account1,
        to: account0,
        amount: 13,
        ok: proxy.expect13,
        fail: proxy.failTest
    });
};
