/*

beh_lib.js - checkpoint behavior library

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

var lib = module.exports = {};

lib.ignore = (function ignoreBeh() {}).toString();
lib.created = (function createdBeh(message) {}).toString();
lib.became = (function becameBeh(message) {}).toString();

lib.account = (function accountBeh(message) {
    // { amount:, ok:, fail: }
    var balance = this.state.balance;
    var amount = (1 * message.amount);
    if (amount) {
        balance += amount;
    }
    if (balance >= 0) {
        this.state.balance = balance;
        message.ok(this.state.balance);
    } else {
        message.fail({
            error: 'Insufficient Funds',
            account: this.self
        });
    }
}).toString();
lib.accountTransfer = (function transferBeh(message) {
    // { from:, to:, amount:, ok:, fail: }
    var debit = this.sponsor((function debitBeh(message) {
        this.state.from({
            amount: -(this.state.amount),
            ok: this.self,  // continue
            fail: this.state.fail
        });
        this.behavior = (function creditBeh(message) {
            this.state.to({
                amount: +(this.state.amount),
                ok: this.state.ok,
                fail: this.self  // continue
            });
            this.behavior = (function reverseBeh(message) {
                this.state.from({
                    amount: +(this.state.amount),
                    ok: this.state.fail,
                    fail: this.state.fail
                });
            }).toString();
        }).toString();
    }).toString(), message);
    debit();
}).toString();
