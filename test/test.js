/*

test.js - checkpoint configuration test

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

test['readme example processes two messages'] = function (test) {
    test.expect(2);
    var checkpoint = tart.checkpoint();

    var testBar = function (message) {
        test.equal(message, 'bar');
    };
    var testFoo = function (message) {
        test.equal(message, 'foo');
        setImmediate(function () {
            test.done();  // test completion
        });
    };
    var testFail = function (message) {
        test.assert(false);  // should not be called
    };

    var oneTimeBeh = "function oneTimeBeh(message) {"
        + "    this.state.testBar(message);"
        + "    var actor = this.sponsor(this.state.createdBeh, this.state);"
        + "    actor('foo');"
        + "    this.behavior = this.state.becomeBeh;"
        + "}";

    var sharedState = {
        createdBeh: "function createdBeh(message) {"
            + "    this.state.testFoo(message);"
            + "}",
        becomeBeh: "function becomeBeh(message) {"
            + "    this.state.testFail(message);"
            + "}",
        testBar: testBar,
        testFoo: testFoo,
        testFail: testFail
    };
    
    var actor = checkpoint.sponsor(oneTimeBeh, sharedState);
    actor('bar');
};
/*
test['domain receptionist dispatches to checkpoint actor'] = function (test) {
    test.expect(2);

    var checkpoint = tart.checkpoint();

    var marshal = require('tart-marshal');
    var remote = marshal.domain('remote',
        checkpoint.domain.sponsor,
        function (message) {
            console.log('REMOTE?', message);
        });

    var oneTimeBeh = "function oneTimeBeh(message) {"
        + "    this.state.test.equal(message, 'bar');"
        + "    var actor = this.sponsor(this.state.createdBeh, {"
        + "        test: this.state.test"
        + "    });"
        + "    actor('foo');"
        + "    this.behavior = this.state.becomeBeh;"
        + "}";

    var oneTimeState = {
        createdBeh: "function createdBeh(message) {"
            + "    this.state.test.equal(message, 'foo');"
            + "    this.state.test.done();"  // test completion
            + "}",
        becomeBeh: "function becomeBeh(message) {"
            + "    this.state.test.assert(false);"  // should not be called
            + "}",
        test: test
    };

    var actor = checkpoint.sponsor(oneTimeBeh, oneTimeState);
    var token = checkpoint.domain.localToRemote(actor);
    checkpoint.domain.receptionist({
        address: token,
        json: checkpoint.domain.encode('baz')
    });
};
*/