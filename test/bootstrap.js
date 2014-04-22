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

var test = module.exports = {};
//test = {};  // FIXME: DISABLE ALL TEST IN THIS SUITE

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

/*
checkpointReceptionist: { address: 'checkpoint#68r3paEw31ozVBvyMNg111706DsRjA2kYV7uuQ7nHCukRTu4wkyWwRdg',
  content: '{"type":":balance","ok":"remote#KQM1MAm6Rn1RKpkrKtwzLkHJi8NJcqKQn3DXnkMMVk1Aqb4HMoqH3GJN","fail":"remote#HmU51BjjoPaoUpMtFNWgyQOj40UD7axlG2PAxnKSmiQ7NEesGmNtKLOV"}' }
applyEffect: { created: 
   [ { self: [Function: send],
       state: [Object],
       behavior: 'function accountBeh(message) {\n    console.log(\'account:\', message);\n    if (message.type === \'balance\') {\n        // { type:\'balance\', ok:, fail: }\n        message.ok(this.state.balance);\n    } else if (message.type === \'adjust\') {\n        // { type:\'adjust\', amount:, ok:, fail: }\n        var balance = this.state.balance + message.amount;\n        if (balance >= 0) {\n            this.state.balance = balance;\n            message.ok(this.state.balance);\n        } else {\n            message.fail({\n                error: \'Insufficient Funds\',\n                account: this.self\n            });\n        }\n    }\n}',
       sponsor: [Function: create] } ],
  sent: [ { message: [Object], context: [Object] } ],
  output: [] }
saveCheckpoint: { created: [],
  sent: [],
  output: 
   [ { address: 'remote#KQM1MAm6Rn1RKpkrKtwzLkHJi8NJcqKQn3DXnkMMVk1Aqb4HMoqH3GJN',
       content: '42' } ],
  event: 
   { message: 
      { type: 'balance',
        ok: [Function: proxyBeh],
        fail: [Function: proxyBeh] },
     context: 
      { self: [Function: send],
        state: [Object],
        behavior: 'function accountBeh(message) {\n    console.log(\'account:\', message);\n    if (message.type === \'balance\') {\n        // { type:\'balance\', ok:, fail: }\n        message.ok(this.state.balance);\n    } else if (message.type === \'adjust\') {\n        // { type:\'adjust\', amount:, ok:, fail: }\n        var balance = this.state.balance + message.amount;\n        if (balance >= 0) {\n            this.state.balance = balance;\n            message.ok(this.state.balance);\n        } else {\n            message.fail({\n                error: \'Insufficient Funds\',\n                account: this.self\n            });\n        }\n    }\n}',
        sponsor: [Function: create] } },
  behavior: 'function accountBeh(message) {\n    console.log(\'account:\', message);\n    if (message.type === \'balance\') {\n        // { type:\'balance\', ok:, fail: }\n        message.ok(this.state.balance);\n    } else if (message.type === \'adjust\') {\n        // { type:\'adjust\', amount:, ok:, fail: }\n        var balance = this.state.balance + message.amount;\n        if (balance >= 0) {\n            this.state.balance = balance;\n            message.ok(this.state.balance);\n        } else {\n            message.fail({\n                error: \'Insufficient Funds\',\n                account: this.self\n            });\n        }\n    }\n}',
  became: 'function accountBeh(message) {\n    console.log(\'account:\', message);\n    if (message.type === \'balance\') {\n        // { type:\'balance\', ok:, fail: }\n        message.ok(this.state.balance);\n    } else if (message.type === \'adjust\') {\n        // { type:\'adjust\', amount:, ok:, fail: }\n        var balance = this.state.balance + message.amount;\n        if (balance >= 0) {\n            this.state.balance = balance;\n            message.ok(this.state.balance);\n        } else {\n            message.fail({\n                error: \'Insufficient Funds\',\n                account: this.self\n            });\n        }\n    }\n}' }
logEffect: {
  "created":[],
  "sent":[],
  "output":[
    { "address":":remote#KQM1MAm6Rn1RKpkrKtwzLkHJi8NJcqKQn3DXnkMMVk1Aqb4HMoqH3GJN",
      "content":":42" } ],
  "event":{
    "message":{
      "type":":balance",
      "ok":"remote#KQM1MAm6Rn1RKpkrKtwzLkHJi8NJcqKQn3DXnkMMVk1Aqb4HMoqH3GJN",
      "fail":"remote#HmU51BjjoPaoUpMtFNWgyQOj40UD7axlG2PAxnKSmiQ7NEesGmNtKLOV" },
    "context":{
      "self":"checkpoint#68r3paEw31ozVBvyMNg111706DsRjA2kYV7uuQ7nHCukRTu4wkyWwRdg",
      "state":{ "balance":42 },
      "behavior":":function accountBeh(message) {\n    console.log('account:', message);\n    if (message.type === 'balance') {\n        // { type:'balance', ok:, fail: }\n        message.ok(this.state.balance);\n    } else if (message.type === 'adjust') {\n        // { type:'adjust', amount:, ok:, fail: }\n        var balance = this.state.balance + message.amount;\n        if (balance >= 0) {\n            this.state.balance = balance;\n            message.ok(this.state.balance);\n        } else {\n            message.fail({\n                error: 'Insufficient Funds',\n                account: this.self\n            });\n        }\n    }\n}",
      "sponsor":"checkpoint#TdqM3dpGKA+xa1cHcVnoWE2zCgN4MMgfkKqm0Wa4Jdrj4Qgoyu+2FroN" } },
  "behavior":":function accountBeh(message) {\n    console.log('account:', message);\n    if (message.type === 'balance') {\n        // { type:'balance', ok:, fail: }\n        message.ok(this.state.balance);\n    } else if (message.type === 'adjust') {\n        // { type:'adjust', amount:, ok:, fail: }\n        var balance = this.state.balance + message.amount;\n        if (balance >= 0) {\n            this.state.balance = balance;\n            message.ok(this.state.balance);\n        } else {\n            message.fail({\n                error: 'Insufficient Funds',\n                account: this.self\n            });\n        }\n    }\n}",
  "became":":function accountBeh(message) {\n    console.log('account:', message);\n    if (message.type === 'balance') {\n        // { type:'balance', ok:, fail: }\n        message.ok(this.state.balance);\n    } else if (message.type === 'adjust') {\n        // { type:'adjust', amount:, ok:, fail: }\n        var balance = this.state.balance + message.amount;\n        if (balance >= 0) {\n            this.state.balance = balance;\n            message.ok(this.state.balance);\n        } else {\n            message.fail({\n                error: 'Insufficient Funds',\n                account: this.self\n            });\n        }\n    }\n}" }
*/

test['can check balance of restored acccount'] = function (test) {
    test.expect(1);
    var checkpoint = tart.checkpoint();
    var sponsor = require('tart').minimal();
    
    var token = 'checkpoint#68r3paEw31ozVBvyMNg111706DsRjA2kYV7uuQ7nHCukRTu4wkyWwRdg';
    var object = {
        state: { balance: 42 },
        behavior: accountBeh
    };
    var snapshot = checkpoint.domain.encode(object);
//  var snapshot = '{"state":{"balance":42},"behavior":":function accountBeh(message) {\n    console.log(\'account:\', message);\n    if (message.type === \'balance\') {\n        // { type:\'balance\', ok:, fail: }\n        message.ok(this.state.balance);\n    } else if (message.type === \'adjust\') {\n        // { type:\'adjust\', amount:, ok:, fail: }\n        var balance = this.state.balance + message.amount;\n        if (balance >= 0) {\n            this.state.balance = balance;\n            message.ok(this.state.balance);\n        } else {\n            message.fail({\n                error: \'Insufficient Funds\',\n                account: this.self\n            });\n        }\n    }\n}"}';
    console.log('snapshot:', snapshot);
    var context = checkpoint.domain.decode(snapshot);
    var actor = checkpoint.sponsor(context.behavior, context.state);
    checkpoint.domain.bindLocal(token, actor);

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
