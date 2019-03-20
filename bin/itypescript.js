#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var child_process_1 = require("child_process");
var fs = require("fs");
var os = require("os");
var path = require("path");
/**
 * Logger for ITypescript launcher
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
            process.stderr.write("ITS: ");
            console.error(msgs.join(" "));
        };
    };
    /**
     * Set logger function as debug level.
     */
    Logger.onProcessDebug = function () {
        try {
            var debugging_1 = require("debug")("ITS:");
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
     * @param printUsage True if I should print usage of ITypescript
     * @param printContext True if I should write down the current running context
     * @param msgs messages to be displayed
     */
    Logger.throwAndExit = function (printUsage, printContext) {
        var msgs = [];
        for (var _i = 2; _i < arguments.length; _i++) {
            msgs[_i - 2] = arguments[_i];
        }
        console.error(msgs.join(" "));
        if (printUsage) {
            Logger.printUsage();
        }
        if (printContext) {
            Logger.printContext();
        }
        process.exit(1);
    };
    /**
     * Print the usage string.
     */
    Logger.printUsage = function () {
        console.error(Logger.usage);
    };
    /**
     * Print the current running context
     */
    Logger.printContext = function () {
        Logger.log(Path.toString());
        Logger.log(Arguments.toString());
    };
    // Usage string
    Logger.usage = "Itypescript Notebook\n\nUsage:\n  its <options>\n\nThe recognized options are:\n  --help                        show ITypescript & notebook help\n  --install=[local|global]      install ITypescript kernel\n  --ts-debug                    enable debug log level\n  --ts-help                     show ITypescript help\n  --ts-off-es-module-interop    Turn off warning for \"esModuleInterop\" option.\n  --ts-hide-undefined           do not show undefined results\n  --ts-hide-execution-result    do not show execution results\n  --ts-protocol=version         set protocol version, e.g. 5.1\n  --ts-startup-script=path      run script on startup\n                                (path can be a file or a folder)\n  --ts-working-dir=path         set session working directory\n                                (default = current working directory)\n  --version                     show ITypescript version\n\nand any other options recognized by the Jupyter notebook; run:\n\n  jupyter notebook --help\n\nfor a full list.\n\nDisclaimer:\n  ITypescript notebook and its kernel are modified version of IJavascript notebook and its kernels.\n  Copyrights of original codes/algorithms belong to IJavascript developers.\n";
    /**
     * Logging function (Do nothing by default).
     */
    Logger.log = function () {
    };
    return Logger;
}());
/**
 * Path helper class
 */
var Path = /** @class */ (function () {
    function Path() {
    }
    // Print the status string
    Path.toString = function () {
        return "\n        PATH: [node: \"" + Path._node + "\", root: \"" + Path._root + "\"]";
    };
    /**
     * Locate files in ITypescript project files
     * @param rest Relative Path from the root of ITypescript
     */
    Path.at = function () {
        var rest = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            rest[_i] = arguments[_i];
        }
        return path.join.apply(path, [Path._root].concat(rest));
    };
    Object.defineProperty(Path, "node", {
        // Location of node runtime
        get: function () {
            return Path._node;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Path, "kernel", {
        // Location of kernel file
        get: function () {
            return Path.at("lib", "kernel.js");
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Path, "images", {
        // Location of image files (logo images)
        get: function () {
            return Path.at("images");
        },
        enumerable: true,
        configurable: true
    });
    // Location of node runtime
    Path._node = process.argv[0];
    // Location of root path of ITypescript
    Path._root = path.dirname(path.dirname(fs.realpathSync(process.argv[1])));
    return Path;
}());
/**
 * Handling arguments which will be passed to child processes, such as jupyter(frontend) or kernel(lib/kernel.js).
 * @property {String[]} context.args.kernel   Command arguments to run kernel
 * @property {String[]} context.args.frontend Command arguments to run frontend
 **/
var Arguments = /** @class */ (function () {
    function Arguments() {
    }
    // Stringify arguments.
    Arguments.toString = function () {
        return "\n        KernelArgs: [" + Arguments._kernel.join(",") + "],\n        FrontendArgs: [" + Arguments._frontend.join(",") + "]";
    };
    Object.defineProperty(Arguments, "kernel", {
        // Get kernel arguments
        get: function () {
            return Arguments._kernel;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Arguments, "frontend", {
        // Get Jupyter frontend arguments
        get: function () {
            return Arguments._frontend;
        },
        enumerable: true,
        configurable: true
    });
    // Add to kernel arguments
    Arguments.passToKernel = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        Arguments._kernel.push(args.join("="));
    };
    // Add to frontend arguments
    Arguments.passToFrontend = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        Arguments._frontend.push(args.join("="));
    };
    // Set exec path of the frontend (Jupyter)
    Arguments.callFrontendWith = function (path) {
        Arguments._frontend[0] = path;
    };
    Arguments._kernel = [
        Path.node,
        Path.kernel
    ];
    Arguments._frontend = [
        "jupyter",
        "notebook",
    ];
    return Arguments;
}());
/**
 * Parse version string and retrieve major version number
 * @param ver The version string to be parsed
 * @return Major version number
 */
function majorVersionOf(ver) {
    var major = parseInt(ver.split(".")[0]);
    if (isNaN(major)) {
        Logger.throwAndExit(false, true, "Error parsing version:", ver);
    }
    return major;
}
/**
 * ITypescript Main Class
 */
var Main = /** @class */ (function () {
    function Main() {
    }
    /**
     * Prepare arguments
     * @param callback Callback called after parsing arguments
     */
    Main.prepare = function (callback) {
        // Arguments specified in command line
        var extraArgs = process.argv.slice(2);
        for (var _i = 0, extraArgs_1 = extraArgs; _i < extraArgs_1.length; _i++) {
            var e = extraArgs_1[_i];
            var _a = e.slice(2).split("="), name_1 = _a[0], values = _a.slice(1);
            // arguments begin with 'ts' should be passed to Kernel
            if (name_1.lastIndexOf("ts", 0) === 0) {
                var subname = name_1.slice(3);
                if (subname === "debug") {
                    Logger.onVerbose();
                }
                else if (subname === "protocol") {
                    Main.protocolVersion = values.join("=");
                }
                switch (subname) {
                    case "debug":
                    case "off-es-module-interop":
                    case "hide-undefined":
                    case "hide-execution-result":
                        Arguments.passToKernel("--" + subname);
                        break;
                    case "protocol":
                    case "startup-script":
                    case "working-dir":
                        Arguments.passToKernel.apply(Arguments, ["--" + subname].concat(values));
                        break;
                    default:
                        Logger.throwAndExit(true, false, "Unknown flag", e);
                }
            }
            else {
                // Otherwise, handle it in the frontend.
                switch (name_1) {
                    case "help":
                        Logger.printUsage();
                        Arguments.passToFrontend(e);
                        break;
                    case "version":
                        console.log(Main.packageJSON.version);
                        process.exit(0);
                        break;
                    case "install":
                        Main.installLoc = values.length > 0 ? values[0].toLowerCase() : "";
                        if (Main.installLoc !== "local" && Main.installLoc !== "global") {
                            Logger.throwAndExit(true, false, "Invalid install location " + Main.installLoc, e);
                        }
                        break;
                    case "KernelManager.kernel_cmd":
                        console.warn("Warning: Flag \"" + e + "\" skipped");
                        break;
                    default:
                        // Other arguments are arguments of frontend scripts.
                        Arguments.passToFrontend(e);
                }
            }
        }
        Arguments.passToKernel("{connection_file}");
        if (callback) {
            callback();
        }
    };
    /**
     * Set the number of Jupyter protocol used.
     */
    Main.setProtocol = function () {
        var frontMajor = majorVersionOf(Main.frontendVersion);
        if (frontMajor < 3) {
            Main.protocolVersion = "4.1";
            Arguments.passToKernel("--protocol", Main.protocolVersion);
            Arguments.passToFrontend("--KernelManager.kernel_cmd", "['" + Arguments.kernel.join("', '") + "']");
            if (majorVersionOf(Main.protocolVersion) >= 5) {
                console.warn("Warning: Protocol v5+ requires Jupyter v3+");
            }
        }
        else {
            Main.protocolVersion = "5.1";
            Arguments.passToKernel("--protocol", Main.protocolVersion);
        }
    };
    /**
     * Identify version of Jupyter/IPython Notebook
     * @param callback
     */
    Main.setJupyterInfoAsync = function (callback) {
        child_process_1.exec("jupyter --version", function (error, stdout) {
            if (error) {
                // If error, try with IPython notebook
                Main.frontIdentificationError = error;
                return Main.setIPythonInfoAsync(callback);
            }
            Arguments.callFrontendWith("jupyter");
            Main.frontendVersion = stdout.toString().trim();
            if (callback) {
                callback();
            }
        });
    };
    /**
     * Identify version of IPython notebook
     * @param callback
     */
    Main.setIPythonInfoAsync = function (callback) {
        child_process_1.exec("ipython --version", function (error, stdout) {
            if (error) {
                if (Main.frontIdentificationError) {
                    console.error("Error running `jupyter --version`");
                    console.error(Main.frontIdentificationError.toString());
                }
                Logger.throwAndExit(false, true, "Error running `ipython --version`\n", error.toString());
            }
            Arguments.callFrontendWith("ipython");
            Main.frontendVersion = stdout.toString().trim();
            if (callback) {
                callback();
            }
        });
    };
    /**
     * Make temporary directory to build kernel spec
     * @param maxAttempts Maximum attempts to make directory
     */
    Main.makeTmpdir = function (maxAttempts) {
        if (maxAttempts === void 0) { maxAttempts = 10; }
        var attempts = 0;
        var tmpdir = null;
        while (!tmpdir && attempts < maxAttempts) {
            attempts++;
            try {
                tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), ".itypescript-"));
            }
            catch (e) {
                tmpdir = null;
            }
        }
        if (tmpdir === null) {
            Logger.throwAndExit(false, false, "Cannot make a temp directory!");
        }
        return tmpdir;
    };
    /**
     * Do asynchronous copy
     * @param srcDir Source directory
     * @param dstDir Destination directory
     * @param callback
     * @param images Image files to be copied
     */
    Main.copyAsync = function (srcDir, dstDir, callback) {
        var images = [];
        for (var _i = 3; _i < arguments.length; _i++) {
            images[_i - 3] = arguments[_i];
        }
        var dstFiles = [];
        var callStack = [];
        if (callback) {
            callStack.push(function () {
                callback.apply(void 0, dstFiles);
            });
        }
        var _loop_1 = function (img) {
            var src = path.join(srcDir, img);
            var dst = path.join(dstDir, img);
            dstFiles.push(dst);
            callStack.push(function () {
                var readStream = fs.createReadStream(src);
                var writeStream = fs.createWriteStream(dst);
                readStream.on("end", function () {
                    var top = callStack.pop();
                    top();
                });
                readStream.pipe(writeStream);
            });
        };
        for (var _a = 0, images_1 = images; _a < images_1.length; _a++) {
            var img = images_1[_a];
            _loop_1(img);
        }
        var top = callStack.pop();
        top();
    };
    /**
     * Install kernel
     * @param callback
     */
    Main.installKernelAsync = function (callback) {
        if (majorVersionOf(Main.frontendVersion) < 3) {
            if (Main.installLoc) {
                console.error("Error: Installation of kernel specs requires Jupyter v3+");
            }
            if (callback) {
                callback();
            }
            return;
        }
        // Create temporary directory to store kernel spec
        var tmpdir = Main.makeTmpdir();
        var specDir = path.join(tmpdir, "typescript");
        fs.mkdirSync(specDir);
        // Create kernel spec file
        var specFile = path.join(specDir, "kernel.json");
        var spec = {
            argv: Arguments.kernel,
            display_name: "Typescript " + require("typescript").version.replace(/([0-9]+\.[0-9]+)\..*/g, "$1"),
            language: "typescript",
        };
        fs.writeFileSync(specFile, JSON.stringify(spec));
        // Copy logo files
        var logoDir = path.join(Path.images);
        Main.copyAsync(logoDir, specDir, function () {
            var dstFiles = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                dstFiles[_i] = arguments[_i];
            }
            // Install with kernel spec file
            var args = [
                Arguments.frontend[0],
                "kernelspec install --replace",
                specDir,
            ];
            if (Main.installLoc === "local") {
                args.push("--user");
            }
            // Launch installation process using frontend
            var cmd = args.join(" ");
            child_process_1.exec(cmd, function (error, stdout, stderr) {
                // Remove temporary spec folder
                fs.unlinkSync(specFile);
                for (var _i = 0, dstFiles_1 = dstFiles; _i < dstFiles_1.length; _i++) {
                    var file = dstFiles_1[_i];
                    fs.unlinkSync(file);
                }
                fs.rmdirSync(specDir);
                fs.rmdirSync(tmpdir);
                if (error) {
                    Logger.throwAndExit(false, true, "Error running \"" + cmd + "\"\n", error.toString(), "\n", stderr ? stderr.toString() : "");
                }
                if (callback) {
                    callback();
                }
            });
        }, "logo-32x32.png", "logo-64x64.png");
    };
    /**
     * Launch frontend script
     */
    Main.spawnFrontend = function () {
        var _a = Arguments.frontend, cmd = _a[0], args = _a.slice(1);
        var frontend = child_process_1.spawn(cmd, args, {
            stdio: "inherit"
        });
        // Relay SIGINT onto the frontend
        process.on("SIGINT", function () {
            frontend.emit("SIGINT");
        });
    };
    // Version of Jupyter protocol
    Main.protocolVersion = null;
    // Version of frontend (Jupyter/IPython)
    Main.frontendVersion = null;
    // Error object while idenitfying frontend's version
    Main.frontIdentificationError = null;
    // Install location of ITypescript kernel.
    Main.installLoc = null;
    // Parse package JSON of ITypescript project
    Main.packageJSON = JSON.parse(fs.readFileSync(Path.at("package.json")).toString());
    return Main;
}());
/*** Below: Launch codes for ITypescript ***/
// Check whether DEBUG is set in the environment
if (process.env["DEBUG"]) {
    Logger.onProcessDebug();
}
// Launch Main process
Main.prepare(function () {
    // Check callnames for Jupyter frontend
    Main.setJupyterInfoAsync(function () {
        // Set protocol version of Jupyter
        Main.setProtocol();
        // Install kernel
        Main.installKernelAsync(function () {
            Logger.printContext();
            // If this is not installing ITypescript kernel, launch it.
            if (!Main.installLoc) {
                Main.spawnFrontend();
            }
        });
    });
});
