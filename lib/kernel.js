#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var path = require("path");
var ts = require("typescript");
var Kernel = require("jp-kernel");
var diff = require("diff");
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
    Logger.usage = "\nUsage: node kernel.js [options] connection_file\nOptions:\n    --debug                     Enables debugging ITypescript kernel\n    --off-es-module-interop     Turn off warning for \"esModuleInterop\" option.\n    --hide-undefined            Hide 'undefined' results\n    --hide-execution-result     Hide the result of execution\n    --protocol=major[.minor[.patch]]]  The version of Jupyter protocol.\n    --working-dir=path  Working directory for this kernel\n    --startup-script=path       Location of a script which ITypescript will execute at startup.\n";
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
        // Indicate whether ESModuleInterop option should be turned off
        this._offESInterop = false;
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
        var result = {};
        for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
            var line = lines_1[_i];
            var _a = line.slice(1).split(" "), keyword = _a[0], args = _a[1];
            switch (keyword.toLowerCase()) {
                case "semantic":
                case "typecheck":
                case "type-check":
                    result["typeChecking"] = args === "on";
                    break;
                case "async":
                case "asynchronous":
                    result["asynchronous"] = args === "on";
                    break;
                default:
                    break;
            }
        }
        return result;
    };
    Object.defineProperty(Configuration.prototype, "config", {
        /**
         * Build-up jp-kernel Config object.
         */
        get: function () {
            // Generate file for transpile
            var options = {};
            var configFile = ts.findConfigFile(this._workingDir, ts.sys.fileExists);
            var rootDir;
            var tsConfigWarnings = [];
            if (!configFile) {
                options = {
                    "module": "commonjs",
                    "target": "es5",
                    "moduleResolution": "nodejs",
                    "allowSyntheticDefaultImports": !this._offESInterop
                };
                rootDir = this._workingDir;
                tsConfigWarnings.push("Configuration is not found! Default configuration will be used: " +
                    JSON.stringify(options));
            }
            else {
                var parsedConfig = ts.readConfigFile(configFile, ts.sys.readFile);
                options = parsedConfig.config;
                rootDir = path.dirname(configFile);
                if (parsedConfig.error) {
                    tsConfigWarnings.push("Error parsing configuration file:" +
                        ts.flattenDiagnosticMessageText(parsedConfig.error.messageText, ts.sys.newLine));
                }
            }
            if (!options["allowSyntheticDefaultImports"] && !this._offESInterop) {
                tsConfigWarnings.push("Without 'allowSyntheticDefaultImports' option in tsconfig.json, import statement may not work as expected. Current configuration: " + JSON.stringify(options));
            }
            if (options["module"] !== "commonjs") {
                tsConfigWarnings.push("The 'module' in tsconfig.json is not 'commonjs'");
            }
            var snapshot = [];
            var workFileVersion = 0;
            var prevLines = 0;
            var prevJSCode = "";
            var FILENAME = "cell.ts";
            var langServHost = {
                getScriptFileNames: function () { return [FILENAME]; },
                getScriptVersion: function (fileName) { return workFileVersion.toString(); },
                getScriptSnapshot: function (fileName) {
                    if (fileName === FILENAME) {
                        return ts.ScriptSnapshot.fromString(snapshot.join("\n"));
                    }
                    else if (!fs.existsSync(fileName)) {
                        return undefined;
                    }
                    return ts.ScriptSnapshot.fromString(fs.readFileSync(fileName).toString());
                },
                getCurrentDirectory: function () { return rootDir; },
                getCompilationSettings: function () { return options; },
                getDefaultLibFileName: function (options) { return ts.getDefaultLibFilePath(options); },
                fileExists: function (filename) {
                    return filename === FILENAME ? true : ts.sys.fileExists(filename);
                },
                readFile: function (filename, encoding) {
                    return filename === FILENAME ? snapshot.join("\n") : ts.sys.readFile(filename, encoding);
                },
                readDirectory: function (path) {
                    return ts.sys.readDirectory(path);
                }
            };
            var services = ts.createLanguageService(langServHost, ts.createDocumentRegistry());
            var execTranspile = function (fileName) {
                var output = services.getEmitOutput(fileName);
                var allDiagnostics = services
                    .getCompilerOptionsDiagnostics()
                    .concat(services.getSyntacticDiagnostics(fileName))
                    .concat(services.getSemanticDiagnostics(fileName));
                if (output.emitSkipped || allDiagnostics.length > 0) {
                    throw Error(allDiagnostics.map(function (diagnostic) {
                        var message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
                        if (diagnostic.file) {
                            var _a = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start), line = _a.line, character = _a.character;
                            if (diagnostic.file.fileName === FILENAME) {
                                var theErrorLine = snapshot[line];
                                var errorPos = "_".repeat(character) + "^";
                                line -= prevLines - 1;
                                if (line < 0) {
                                    return "Conflict with a committed line: \n" + theErrorLine + "\n" + errorPos + "\n" + message;
                                }
                                else {
                                    return "Line " + line + ", Character " + (character + 1) + "\n" + theErrorLine + "\n" + errorPos + "\n" + message;
                                }
                            }
                            else {
                                return diagnostic.file.fileName + " Line " + line + ", Character " + (character + 1) + ": " + message;
                            }
                        }
                        else {
                            return message;
                        }
                    }).join("\n\n"));
                }
                return output.outputFiles[0].text;
            };
            var transpiler = function (rawCode) {
                var code = rawCode.split("\n");
                var overrideOptions = {};
                if (code[0].startsWith("%")) {
                    overrideOptions = Configuration.parseOptions(code.filter(function (x) { return x.startsWith("%"); }));
                    code = code.filter(function (x) { return !x.startsWith("%"); });
                }
                if (overrideOptions["asynchronous"]) {
                    code = ["$$.async();"].concat(code);
                }
                workFileVersion += 1;
                snapshot.push.apply(snapshot, code);
                try {
                    var generated = execTranspile(FILENAME);
                    var codeChange = diff.diffLines(prevJSCode, generated, { newlineIsToken: true });
                    var codeslice = codeChange.filter(function (s) { return s.added; }).map(function (s) { return s.value; }).join("\n");
                    prevLines = snapshot.length;
                    prevJSCode = generated;
                    if (tsConfigWarnings && workFileVersion > 1) {
                        // Prepend warnings before code
                        var warnings = tsConfigWarnings.map(function (str) {
                            return "$$.html(\"<p style='color:orange'>" + str.replace(/"/g, "\\\"") + "</p>\");\n";
                        }).join("\n");
                        codeslice = warnings + codeslice;
                        tsConfigWarnings = [];
                    }
                    return codeslice;
                }
                catch (e) {
                    snapshot = snapshot.slice(0, prevLines);
                    throw e;
                }
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
    Configuration.prototype.offESInterop = function () {
        this._offESInterop = true;
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
                        "mimetype": "application/x-typescript",
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
