/*

readme.js - readme example script

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

var checkpoint = tart.checkpoint();

var oneTimeBeh = (function oneTimeBeh(message) {
    console.log('oneTimeBeh:', message);
    var becomeBeh = (function becomeBeh(message) {}).toString();
    var actor = this.sponsor((function createdBeh(message) {
        console.log('createdBeh:', message);
    }).toString()); // create
    actor(this.state.label); // send
    this.behavior = becomeBeh; // become
}).toString();

var actor = checkpoint.sponsor(oneTimeBeh, { label:'foo' });
actor('bar');
