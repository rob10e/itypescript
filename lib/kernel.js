#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var path = require("path");
var ts = require("typescript");
var Kernel = require("jp-kernel");
var $TScode = fs.readFileSync(path.join(__dirname, "startup.ts")).toString("UTF-8");
/**
 * A logger class for error/debug messages
 */
var Logger = /** @class */ (function () {
    function Logger() {
    }
    /**
     * Set logger function as verbose level.
     */
    Logger.onVerbose = function () {
        Logger.log = function () {
            var msgs = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                msgs[_i] = arguments[_i];
            }
            process.stderr.write("KERNEL: ");
            console.error(msgs.join(" "));
        };
    };
    /**
     * Set logger function as debug level.
     */
    Logger.onProcessDebug = function () {
        try {
            var debugging_1 = require("debug")("KERNEL:");
            Logger.log = function () {
                var msgs = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    msgs[_i] = arguments[_i];
                }
                debugging_1(msgs.join(" "));
            };
        }
        catch (err) {
            Logger.onVerbose();
        }
    };
    /**
     * Throw fatal error and exit.
     * @param msgs messages to be displayed
     */
    Logger.throwAndExit = function () {
        var msgs = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            msgs[_i] = arguments[_i];
        }
        console.error(msgs.join(" "));
        Logger.printUsage();
        process.exit(1);
    };
    /**
     * Print the usage string.
     */
    Logger.printUsage = function () {
        console.error(Logger.usage);
    };
    Logger.usage = "\nUsage: node kernel.js [options] connection_file\nOptions:\n    --debug                     Enables debugging ITypescript kernel\n    --semantic                  Enables typechecking\n    --hide-undefined            Hide 'undefined' results\n    --hide-execution-result     Hide the result of execution\n    --protocol=major[.minor[.patch]]]  The version of Jupyter protocol.\n    --working-dir=path  Working directory for this kernel\n    --startup-script=path       Location of a script which ITypescript will execute at startup.\n";
    /**
     * Logging function (Do nothing by default).
     */
    Logger.log = function () {
    };
    return Logger;
}());
/**
 * Configuration builder class for ITypescript kernel
 */
var Configuration = /** @class */ (function () {
    function Configuration() {
        // Indicate whether this kernel is under debug
        this._onDebug = false;
        // Indicate whether execution needs typechecking
        this._onTypeChk = false;
        // Path of working directory
        this._workingDir = process.cwd();
        // Indicate whether I should hide undefined result
        this.hideUndefined = false;
        // Indicate whether I should hide execution result
        this.hideExecutionResult = false;
        // The version of protocol
        this.protocolVer = "5.1";
        // Basic startup script (Enable $TS usage)
        this.onStartup = function () {
            this.session.execute($TScode, {});
        };
        // Is kernel connected?
        this.isConnSet = false;
        // The object handles Jupyter connection
        this.conn = {};
    }
    Configuration.parseOptions = function (lines) {
        var result = {
            kernelConfig: {},
            compilerOpts: {}
        };
        for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
            var line = lines_1[_i];
            var _a = line.slice(1).split(" "), keyword = _a[0], args = _a[1];
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
    };
    Object.defineProperty(Configuration.prototype, "config", {
        /**
         * Build-up jp-kernel Config object.
         */
        get: function () {
            var _this = this;
            // Generate file for transpile
            var previousCodeLength = 0;
            var previouslySuccessfulCode = "";
            var execCount = -1;
            var configOpt = {
                "module": ts.ModuleKind.CommonJS,
                "target": ts.ScriptTarget.ES5,
                "moduleResolution": ts.ModuleResolutionKind.NodeJs
            };
            var compilerOpt = ts.convertCompilerOptionsFromJson(configOpt, this._workingDir);
            var configOptATime = 0;
            var transpiler = function (rawCode) {
                var configFile = ts.findConfigFile(_this._workingDir, ts.sys.fileExists);
                var atime = configFile ? fs.statSync(configFile).atime.getMilliseconds() : 0;
                if (atime !== configOptATime) {
                    configOpt = JSON.parse(fs.readFileSync(configFile).toString()).compilerOptions;
                    compilerOpt = ts.convertCompilerOptionsFromJson(configOpt, _this._workingDir, configFile);
                    configOptATime = atime;
                }
                var errMsg = [];
                for (var _i = 0, _a = compilerOpt.errors; _i < _a.length; _i++) {
                    var diagnostic = _a[_i];
                    errMsg.push("Error " + diagnostic.code + " : " +
                        ts.flattenDiagnosticMessageText(diagnostic.messageText, ts.sys.newLine));
                }
                if (errMsg.length)
                    throw Error(errMsg.join("\n"));
                var code = rawCode;
                var overrideOptions = { kernelConfig: {}, compilerOpts: {} };
                if (code.startsWith("%")) {
                    var lines = code.split("\n");
                    overrideOptions = Configuration.parseOptions(lines.filter(function (x) { return x.startsWith("%"); }));
                    code = lines.filter(function (x) { return !x.startsWith("%"); }).join("\n");
                }
                console.log(overrideOptions, code);
                var typeChecking = overrideOptions.kernelConfig.hasOwnProperty("typeChecking") ?
                    overrideOptions.kernelConfig["typeChecking"] : _this._onTypeChk;
                if (overrideOptions.kernelConfig.hasOwnProperty("asynchronous")) {
                    code = "$$async$$ = " + overrideOptions.kernelConfig["asynchronous"] + "\n" + code;
                }
                var options = {};
                for (var _b = 0, _c = Object.keys(compilerOpt.options); _b < _c.length; _b++) {
                    var key = _c[_b];
                    options[key] = compilerOpt.options[key];
                }
                for (var _d = 0, _e = Object.keys(overrideOptions.compilerOpts); _d < _e.length; _d++) {
                    var key = _e[_d];
                    options[key] = compilerOpt.options[key];
                }
                var output = ts.transpileModule(previouslySuccessfulCode + "\n" + code, {
                    compilerOptions: options,
                    reportDiagnostics: typeChecking,
                    moduleName: "Cell [" + execCount + "]",
                    fileName: "Cell [" + execCount + "]"
                });
                for (var _f = 0, _g = output.diagnostics; _f < _g.length; _f++) {
                    var diagnostic = _g[_f];
                    errMsg.push("Error " + diagnostic.code + " : " +
                        ts.flattenDiagnosticMessageText(diagnostic.messageText, ts.sys.newLine));
                }
                if (errMsg.length)
                    throw Error(errMsg.join("\n"));
                var transpiled = output.outputText.slice(previousCodeLength);
                previouslySuccessfulCode += "\n" + code;
                previousCodeLength = output.outputText.length;
                execCount += 1;
                return transpiled;
            };
            // Object for return (set by default)
            var baseObj = {
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
            }
            else {
                Logger.throwAndExit("Error: missing {connectionFile}");
            }
            return baseObj;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Configuration.prototype, "connectionWith", {
        /**
         * Connect jp-kernel
         * @param filepath Path of connection file.
         */
        set: function (filepath) {
            // If connection is already set, throw and exit.
            if (this.isConnSet) {
                Logger.throwAndExit("Error: {connectionFile} cannot be set more than once");
            }
            this.isConnSet = true;
            this.conn = JSON.parse(fs.readFileSync(filepath).toString());
        },
        enumerable: true,
        configurable: true
    });
    // Turn on debug feature
    Configuration.prototype.onDebug = function () {
        this._onDebug = true;
    };
    // Turn on typechecking feature
    Configuration.prototype.onTypeChk = function () {
        this._onTypeChk = true;
    };
    // Turn on hiding undefined results
    Configuration.prototype.hideUndef = function () {
        this.hideUndefined = true;
    };
    // Turn on hiding execution results
    Configuration.prototype.hideExec = function () {
        this.hideExecutionResult = true;
    };
    Object.defineProperty(Configuration.prototype, "workingDir", {
        /**
         * Set working directory as given path
         * @param path Path for working directory
         */
        set: function (path) {
            this._workingDir = path;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Configuration.prototype, "protocolVersion", {
        /**
         * Set protocol version of Jupyter
         * @param ver Version to be set.
         */
        set: function (ver) {
            this.protocolVer = ver;
            var majorVersion = parseInt(ver.split(".")[0]);
            if (majorVersion <= 4) {
                var tsVer = ts.version.split(".")
                    .map(function (v) {
                    return parseInt(v, 10);
                });
                var protocolVersion = ver.split(".")
                    .map(function (v) {
                    return parseInt(v, 10);
                });
                this.response = {
                    "language": "typescript",
                    "language_version": tsVer,
                    "protocol_version": protocolVersion,
                };
            }
            else {
                var itsVersion = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json")).toString()).version;
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
                    "banner": ("ITypescript v" + itsVersion + "\n" +
                        "https://github.com/nearbydelta/itypescript\n"),
                    "help_links": [{
                            "text": "TypeScript Doc",
                            "url": "http://typescriptlang.org/docs/",
                        }],
                };
            }
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Configuration.prototype, "startupScript", {
        /**
         * Set startup script
         * @param script Script code to be launched.
         */
        set: function (script) {
            this._startupScript = script;
        },
        enumerable: true,
        configurable: true
    });
    return Configuration;
}());
/**
 * Argument parser class
 */
var Parser = /** @class */ (function () {
    function Parser() {
    }
    /**
     * Parse arguments of this process
     */
    Parser.parse = function () {
        // Generate a configuration builder
        var configBuilder = new Configuration();
        // Load arguments
        var argv = process.argv.slice(2);
        // For each arguments, check and update configuration.
        for (var _i = 0, argv_1 = argv; _i < argv_1.length; _i++) {
            var arg = argv_1[_i];
            var _a = arg.slice(2).split("="), name_1 = _a[0], values = _a.slice(1);
            switch (name_1) {
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
    };
    return Parser;
}());
/*** Below: Launch codes for Kernel ***/
// Check whether DEBUG is set in the environment
if (process.env["DEBUG"]) {
    Logger.onProcessDebug();
}
// Parse configuration
var config = Parser.parse();
// Start kernel with parsed configuration
var kernel = new Kernel(config);
// Interpret a SIGINT signal as a request to interrupt the kernel
process.on("SIGINT", function () {
    Logger.log("Interrupting kernel");
    kernel.destroy(); // Destroy the connection
});
