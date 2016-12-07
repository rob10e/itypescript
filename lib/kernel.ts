#!/usr/bin/env tsun

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

import console = require("console");
import fs = require("fs");
import path = require("path");
import Kernel = require("jp-kernel");

class Logger{
    private static usage = `
Usage: tsun kernel.ts [--debug] [--hide-undefined] [--protocol=Major[.minor[.patch]]] [--session-working-dir=path] [--show-undefined] [--startup-script=path] connection_file
`;

    static throwAndExit: (...msgs:string[]) => void;

}

interface KernelConfig{
    cwd: string;
    hideUndefined: boolean;
    protocolVersion: string;
    startupCallback: () => void;
    debug: boolean;
    kernelInfoReply: Object;
    startupScript?: string;
    conn?: Object;
}

class Configuration{
    private onDebug: boolean = false;
    private workingDir: string = process.cwd();
    private hideUndefined: boolean = false;
    private protocolVer: string = "5.0";
    private onStartup: () => void = function(){
        Logger.log("startupCallback:", this.startupCallback);
    };
    private isConnSet: boolean = false;
    private conn: Object = {};
    private response: Object;
    private startupScript: string;

    get config(): KernelConfig {
        let baseObj: KernelConfig = {
            cwd: this.workingDir,
            hideUndefined: this.hideUndefined,
            protocolVersion: this.protocolVer,
            startupCallback: this.onStartup,
            debug: this.onDebug,
            kernelInfoReply: this.response
            startupScript: this.startupScript
        };

        if(this.isConnSet){
            baseObj.connection = this.conn;
        }else{
            Logger.throwAndExit("Error: missing {connectionFile}");
        }

        if(this.startupScript){
            baseObj.startupScript = this.startupScript;
        }

        return baseObj;
    }

    set connectionWith(path: string){
        if(this.isConnSet){
            Logger.throwAndExit("Error: {connectionFile} cannot be duplicated");
        }

        this.isConnSet = true;
        this.conn = JSON.parse(fs.readFileSync(path));
    }

    onDebug(){
        this.onDebug = true;
    }

    hideUndef(){
        this.hideUndefined = true;
    }

    showUndef(){
        this.hideUndefined = true;
    }

    set workingDir(path: string){
        this.workingDir = path;
    }

    set protocolVersion(ver: string){
        this.protocolVer = ver;
        let majorVersion: number = parseInt(ver.split(".")[0]);

        if(majorVersion <= 4){
            let nodeVersion = process.versions.node.split('.')
                .map(function (v) {
                    return parseInt(v, 10);
                });
            let protocolVersion = ver.split('.')
                .map(function (v) {
                    return parseInt(v, 10);
                });
            this.kernelInfoReply = {
                "language": "javascript",
                "language_version": nodeVersion,
                "protocol_version": protocolVersion,
            };
        }else{
            let nodeVersion = process.versions.node;
            let ijsVersion = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"))).version;
            this.kernelInfoReply = {
                "protocol_version": ver,
                "implementation": "ijavascript",
                "implementation_version": ijsVersion,
                "language_info": {
                    "name": "javascript",
                    "version": nodeVersion,
                    "mimetype": "application/javascript",
                    "file_extension": ".js",
                },
                "banner": (
                    "IJavascript v" + ijsVersion + "\n" +
                    "https://github.com/n-riesco/ijavascript\n"
                ),
                "help_links": [{
                    "text": "IJavascript Homepage",
                    "url": "https://github.com/n-riesco/ijavascript",
                }],
            };

        }
    }

    set startupScript(script: string){
        this.startupScript = script;
    }
}

/**
 * Parse command arguments
 *
 * @returns {module:jp-kernel~Config} Kernel config
 */
class Parser {
    static parse(): KernelConfig{
        let configBuilder = new Configuration();
        let argv = process.argv.slice(2);

        for(arg in argv){
            let [name, ...values] = flag.slice(2).split('=');
            switch(name){
                case 'debug':
                    configBuilder.onDebug();
                    break;
                case 'hide-undefined':
                    configBuilder.hideUndef();
                    break;
                case 'protocol':
                    configBuilder.protocolVersion = values.join('=');
                    break;
                case 'session-working-dir':
                    configBuilder.workingDir = values.join('=');
                    break;
                case 'show-undefined':
                    configBuilder.showUndef();
                    break;
                case 'startup-script':
                    configBuilder.startupScript = values.join('=');
                    break;
                default:
                    configBuilder.connectionWith = flags;
                    break;
            }
        }

        return configBuilder.config;
    }
}

let config = Parser.parse();

// Start kernel
let kernel = new Kernel(config);

// Interpret a SIGINT signal as a request to interrupt the kernel
process.on("SIGINT", function () {
    Logger.log("Interrupting kernel");
    kernel.restart(); // TODO(NR) Implement kernel interruption
});

