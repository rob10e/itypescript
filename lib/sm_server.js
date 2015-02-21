/*
 * BSD 3-Clause License
 *
 * Copyright (c) 2015, Nicolas Riesco and others as credited in the AUTHORS file
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice,
 * this list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 * this list of conditions and the following disclaimer in the documentation
 * and/or other materials provided with the distribution.
 *
 * 3. Neither the name of the copyright holder nor the names of its contributors
 * may be used to endorse or promote products derived from this software without
 * specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 *
 */

(function() {
    var DEBUG = false;

    var util = require("util");
    var vm = require("vm");

    process.on("message", onMessage.bind(this));

    function onMessage(request) {
        var action = request[0];
        var code = request[1];
        var response;
        if (action === "getAllPropertyNames") {
            try {
                response = {
                    names: getAllPropertyNames(run(code))
                };
            } catch (e) {
                response = formatError(e);
            }
        } else if (action === "run") {
            try {
                response = formatResult(run(code));
            } catch (e) {
                response = formatError(e);
            }
        } else {
            if (DEBUG) {
                console.log("VM: onMessage: Unhandled request message:",
                    request);
            }
            return;
        }

        if (DEBUG) {
            console.log("VM: onMessage: REQUEST:", request);
            console.log("VM: onMessage: RESPONSE:", response);
        }
        send(response);
    }

    function send(message) {
        if (DEBUG) console.log("VM: send:", message);
        process.send(message);
    }

    function formatResult(result) {
        return {
            mime: {
                "text/plain": util.inspect(result),
                "text/html": toHtml(result),
            }
        };

        function toHtml(obj) {
            return "<pre>" + util.inspect(obj).
            replace(/&/g, '&amp;').
            replace(/</g, '&lt;').
            replace(/>/g, '&gt;').
            replace(/"/g, '&quot;').
            replace(/'/g, '&#39;') + "</pre>";
        }
    }

    function formatError(error) {
        return {
            error: {
                ename: error.name,
                evalue: error.message,
                traceback: error.stack.split("\n"),
            }
        };
    }

    function run(code) {
        return vm.runInThisContext(code);
    }

    function getAllPropertyNames(object) {
        var propertyList = [];

        var prototype = object;
        var prototypeList = [object];

        function pushToPropertyList(elt) {
            if (propertyList.indexOf(elt) === -1) {
                propertyList.push(elt);
            }
        }
        while (true) {
            Object.getOwnPropertyNames(prototype).forEach(pushToPropertyList);

            prototype = Object.getPrototypeOf(prototype);
            if (prototype === null) {
                break;
            }

            if (prototypeList.indexOf(prototype) === -1) {
                prototypeList.push(prototype);
            }
        }

        return propertyList.sort();
    }
})();