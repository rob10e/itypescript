#!/usr/bin/env node

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

// Import required packages
import fs = require("fs");
import path = require("path");
import ts = require("typescript");
import Kernel = require("jp-kernel");

let $TScode = fs.readFileSync(path.join(__dirname, "startup.ts")).toString("UTF-8");

/**
 * A logger class for error/debug messages
 */
class Logger {
    private static usage = `
Usage: node kernel.js [options] connection_file
Options:
    --debug                     Enables debugging ITypescript kernel
    --semantic                  Enables typechecking
    --hide-undefined            Hide 'undefined' results
    --hide-execution-result     Hide the result of execution
    --protocol=major[.minor[.patch]]]  The version of Jupyter protocol.
    --working-dir=path  Working directory for this kernel
    --startup-script=path       Location of a script which ITypescript will execute at startup.
`;

    /**
     * Logging function (Do nothing by default).
     */
    static log: (...msgs: any[]) => void = () => {
    }

    /**
     * Set logger function as verbose level.
     */
    static onVerbose() {
        Logger.log = (...msgs: any[]) => {
            process.stderr.write("KERNEL: ");
            console.error(msgs.join(" "));
        };
    }

    /**
     * Set logger function as debug level.
     */
    static onProcessDebug() {
        try {
            let debugging = require("debug")("KERNEL:");
            Logger.log = (...msgs: any[]) => {
                debugging(msgs.join(" "));
            };
        } catch (err) {
            Logger.onVerbose();
        }
    }

    /**
     * Throw fatal error and exit.
     * @param msgs messages to be displayed
     */
    static throwAndExit(...msgs: any[]) {
        console.error(msgs.join(" "));
        Logger.printUsage();
        process.exit(1);
    }

    /**
     * Print the usage string.
     */
    static printUsage() {
        console.error(Logger.usage);
    }
}

/**
 * A data interface which represents [Config](https://n-riesco.github.io/jp-kernel/global.html#Config) class in jp-kernel
 */
interface KernelConfig {
    // Frontend connection file
    connection?: Object;

    // Session current working directory
    cwd: string;

    // Enable debug mode
    debug: boolean;

    // Do not show execution result
    hideExecutionResult: boolean;

    // Do not show undefined results
    hideUndefined: boolean;

    // Content of kernel_info_reply message
    kernelInfoReply: Object;

    // Message protocol version
    protocolVersion: string;

    // Callback invoked at session startup.
    // This callback can be used to setup a session; e.g. to register a require extensions.
    startupCallback: () => void;

    // Path to a script to be run at startup.
    // Path to a folder also accepted, in which case all the scripts in the folder will be run.
    startupScript?: string;

    // If defined, this function transpiles the request code into Javascript that can be run by the Node.js session.
    transpile?: (code: string) => string;
}

/**
 * Configuration builder class for ITypescript kernel
 */
class Configuration {
    // Indicate whether this kernel is under debug
    private _onDebug: boolean = false;

    // Indicate whether execution needs typechecking
    private _onTypeChk: boolean = false;

    // Path of working directory
    private _workingDir: string = process.cwd();

    // Indicate whether I should hide undefined result
    private hideUndefined: boolean = false;

    // Indicate whether I should hide execution result
    private hideExecutionResult: boolean = false;

    // The version of protocol
    private protocolVer: string = "5.1";

    // Basic startup script (Enable $TS usage)
    private onStartup = function () {
        this.session.execute($TScode, {});
    };

    // Is kernel connected?
    private isConnSet: boolean = false;

    // The object handles Jupyter connection
    private conn: Object = {};

    // The response which will be sent to Jupyter
    private response: Object;

    // The startup script
    private _startupScript: string;

    static parseOptions(lines: string[]) {
        let result = {
            kernelConfig: {},
            compilerOpts: {}
        };

        for (let line of lines) {
            let [keyword, args] = line.slice(1).split(" ");
            switch (keyword.toLowerCase()) {
                case "semantic":
                case "typecheck":
                case "type-check":
                    result.kernelConfig["typeChecking"] = args === "on";
                    break;
                case "async":
                case "asynchronous":
                    result.kernelConfig["asynchronous"] = args === "on";
                    break;
                default:
                    result.compilerOpts[keyword.toLowerCase()] = JSON.parse(args);
            }
        }

        return result;
    }

    /**
     * Build-up jp-kernel Config object.
     */
    get config(): KernelConfig {
        // Generate file for transpile
        let previousCodeLength = 0;
        let previouslySuccessfulCode = "";
        let execCount = -1;

        let configOpt = {
            "module": ts.ModuleKind.CommonJS,
            "target": ts.ScriptTarget.ES5,
            "moduleResolution": ts.ModuleResolutionKind.NodeJs
        };

        let compilerOpt = ts.convertCompilerOptionsFromJson(configOpt, this._workingDir);
        let configOptATime = 0;

        let transpiler = (rawCode: string) => {
            const configFile = ts.findConfigFile(this._workingDir, ts.sys.fileExists);
            let atime = configFile ? fs.statSync(configFile).atime.getMilliseconds() : 0;
            if (atime !== configOptATime) {
                configOpt = JSON.parse(fs.readFileSync(configFile).toString()).compilerOptions;
                compilerOpt = ts.convertCompilerOptionsFromJson(configOpt, this._workingDir, configFile);
                configOptATime = atime;
            }

            let errMsg = [];
            for (let diagnostic of compilerOpt.errors) {
                errMsg.push("Error " + diagnostic.code + " : " +
                    ts.flattenDiagnosticMessageText(diagnostic.messageText, ts.sys.newLine));
            }

            if (errMsg.length)
                throw Error(errMsg.join("\n"));

            let code = rawCode;
            let overrideOptions = {kernelConfig: {}, compilerOpts: {}};
            if (code.startsWith("%")) {
                const lines = code.split("\n");
                overrideOptions = Configuration.parseOptions(lines.filter(x => x.startsWith("%")));
                code = lines.filter(x => !x.startsWith("%")).join("\n");
            }

            console.log(overrideOptions, code);

            let typeChecking = overrideOptions.kernelConfig.hasOwnProperty("typeChecking") ?
                overrideOptions.kernelConfig["typeChecking"] : this._onTypeChk;
            if (overrideOptions.kernelConfig.hasOwnProperty("asynchronous")) {
                code = `$$async$$ = ${overrideOptions.kernelConfig["asynchronous"]}\n` + code;
            }

            let options = {};
            for (let key of Object.keys(compilerOpt.options)){
                options[key] = compilerOpt.options[key];
            }
            for (let key of Object.keys(overrideOptions.compilerOpts)){
                options[key] = compilerOpt.options[key];
            }

            const output = ts.transpileModule(previouslySuccessfulCode + "\n" + code, {
                compilerOptions: options,
                reportDiagnostics: typeChecking,
                moduleName: `Cell [${execCount}]`,
                fileName: `Cell [${execCount}]`
            });

            for (let diagnostic of output.diagnostics) {
                errMsg.push("Error " + diagnostic.code + " : " +
                    ts.flattenDiagnosticMessageText(diagnostic.messageText, ts.sys.newLine));
            }

            if (errMsg.length)
                throw Error(errMsg.join("\n"));

            let transpiled = output.outputText.slice(previousCodeLength);

            previouslySuccessfulCode += "\n" + code;
            previousCodeLength = output.outputText.length;
            execCount += 1;

            return transpiled;
        };

        // Object for return (set by default)
        let baseObj: KernelConfig = {
            cwd: this._workingDir,
            hideUndefined: this.hideUndefined,
            hideExecutionResult: this.hideExecutionResult,
            protocolVersion: this.protocolVer,
            startupCallback: this.onStartup,
            debug: this._onDebug,
            kernelInfoReply: this.response,
            startupScript: this._startupScript,
            transpile: transpiler
        };

        // If the connection is missing, throw error.
        if (this.isConnSet) {
            baseObj.connection = this.conn;
        } else {
            Logger.throwAndExit("Error: missing {connectionFile}");
        }

        return baseObj;
    }

    /**
     * Connect jp-kernel
     * @param filepath Path of connection file.
     */
    set connectionWith(filepath: string) {
        // If connection is already set, throw and exit.
        if (this.isConnSet) {
            Logger.throwAndExit("Error: {connectionFile} cannot be set more than once");
        }

        this.isConnSet = true;
        this.conn = JSON.parse(fs.readFileSync(filepath).toString());
    }

    // Turn on debug feature
    onDebug() {
        this._onDebug = true;
    }

    // Turn on typechecking feature
    onTypeChk() {
        this._onTypeChk = true;
    }

    // Turn on hiding undefined results
    hideUndef() {
        this.hideUndefined = true;
    }

    // Turn on hiding execution results
    hideExec() {
        this.hideExecutionResult = true;
    }

    /**
     * Set working directory as given path
     * @param path Path for working directory
     */
    set workingDir(path: string) {
        this._workingDir = path;
    }

    /**
     * Set protocol version of Jupyter
     * @param ver Version to be set.
     */
    set protocolVersion(ver: string) {
        this.protocolVer = ver;
        let majorVersion: number = parseInt(ver.split(".")[0]);

        if (majorVersion <= 4) {
            let tsVer = ts.version.split(".")
                .map(function (v) {
                    return parseInt(v, 10);
                });
            let protocolVersion = ver.split(".")
                .map(function (v) {
                    return parseInt(v, 10);
                });
            this.response = {
                "language": "typescript",
                "language_version": tsVer,
                "protocol_version": protocolVersion,
            };
        } else {
            let itsVersion = JSON.parse(
                fs.readFileSync(path.join(__dirname, "..", "package.json")).toString()
            ).version;
            this.response = {
                "protocol_version": ver,
                "implementation": "typescript",
                "implementation_version": itsVersion,
                "language_info": {
                    "name": "typescript",
                    "version": ts.version,
                    "mimetype": "text/x-typescript",
                    "file_extension": ".ts"
                },
                "banner": (
                    "ITypescript v" + itsVersion + "\n" +
                    "https://github.com/nearbydelta/itypescript\n"
                ),
                "help_links": [{
                    "text": "TypeScript Doc",
                    "url": "http://typescriptlang.org/docs/",
                }],
            };

        }
    }

    /**
     * Set startup script
     * @param script Script code to be launched.
     */
    set startupScript(script: string) {
        this._startupScript = script;
    }
}

/**
 * Argument parser class
 */
class Parser {
    /**
     * Parse arguments of this process
     */
    static parse(): KernelConfig {
        // Generate a configuration builder
        let configBuilder = new Configuration();
        // Load arguments
        let argv = process.argv.slice(2);

        // For each arguments, check and update configuration.
        for (let arg of argv) {
            let [name, ...values] = arg.slice(2).split("=");
            switch (name) {
                case "debug":
                    configBuilder.onDebug();
                    Logger.onVerbose();
                    break;
                case "semantic":
                    configBuilder.onTypeChk();
                    break;
                case "hide-undefined":
                    configBuilder.hideUndef();
                    break;
                case "hide-execution-result":
                    configBuilder.hideExec();
                    break;
                case "protocol":
                    configBuilder.protocolVersion = values.join("=");
                    break;
                case "working-dir":
                    configBuilder.workingDir = values.join("=");
                    break;
                case "startup-script":
                    configBuilder.startupScript = values.join("=");
                    break;
                default:
                    configBuilder.connectionWith = arg;
                    break;
            }
        }

        return configBuilder.config;
    }
}

/*** Below: Launch codes for Kernel ***/

// Check whether DEBUG is set in the environment
if (process.env["DEBUG"]) {
    Logger.onProcessDebug();
}

// Parse configuration
let config = Parser.parse();

// Start kernel with parsed configuration
let kernel = new Kernel(config);

// Interpret a SIGINT signal as a request to interrupt the kernel
process.on("SIGINT", function () {
    Logger.log("Interrupting kernel");
    kernel.destroy(); // Destroy the connection
});

