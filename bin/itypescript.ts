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
import {exec, spawn} from "child_process";
import fs = require("fs");
import os = require("os");
import path = require("path");
import uuid = require("uuid");

// Setup logging helpers
class Logger {
    private static usage: string = `Itypescript Notebook

Usage:
  its <options>

The recognized options are:
  --help                        show ITypescript & notebook help
  --its-debug                   enable debug log level
  --its-help                    show ITypescript help
  --its-hide-undefined          do not show undefined results
  --its-install=[local|global]  install ITypescript kernel
  --its-protocol=version        set protocol version, e.g. 4.1
  --its-show-undefined          show undefined results
  --its-spec-path=[none|full]   set whether kernel spec uses full paths
  --its-startup-script=path     run script on startup
                                (path can be a file or a folder)
  --its-working-dir=path        set session working directory
                                (default = current working directory)
  --version                     show ITypescript version

and any other options recognized by the Jupyter notebook; run:

  jupyter notebook --help

for a full list.

Disclaimer:
  ITypescript notebook and its kernel are modified version of IJavascript notebook and its kernels.
  Copyrights of original codes/algorithms belong to IJavascript developers.
`

    private static onDebug: boolean = false;
    static log: (...msgs: any[]) => void = function (...msgs: any[]) {
    };

    static onVerbose() {
        Logger.log = function (...msgs: any[]) {
            process.stderr.write("ITS: ");
            console.error(msgs.join(" "));
        };
    }

    static onProcessDebug() {
        try {
            import "debug";
            let debugging = debug("ITS:");
            Logger.log = function (...msgs: any[]) {
                debugging(msgs.join(" "));
            };
        } catch (err) {
            Logger.onVerbose();
        }
    }

    static throwAndExit(printUsage: boolean, printContext: boolean, ...msgs: any[]) {
        console.error(msgs.join(" "));
        if (printUsage) {
            Logger.printUsage();
        }
        if (printContext) {
            Logger.printContext();
        }
        process.exit(1);
    }

    static printUsage() {
        console.error(Logger.usage);
    }

    static printContext(){
        Logger.log(Path.toString());
        Logger.log(Arguments.toString());
        Logger.log(Flags.toString());
        Logger.log(Protocol.toString());
        Logger.log(Frontend.toString());
    }
}

/**
 * @property {String}   context.path.node     Path to Node.js shell
 * @property {String}   context.path.root     Path to IJavascript root folder
 * @property {String}   context.path.kernel   Path to IJavascript kernel
 * @property {String}   context.path.images   Path to IJavascript images folder
 * @property {Object}   context.packageJSON   Contents of npm package.json
 **/
class Path {
    private static node: string = process.argv[0];
    private static root: string = path.dirname(path.dirname(fs.realpathSync(process.argv[1])));

    static toString() {
        return `
        PATH: [node: '${Path.node}', root: '${Path.root}']`;
    }

    static at(...rest: string[]): string {
        return path.join(Path.root, ...rest);
    }

    static get node(): string {
        return Path.node;
    }

    static get kernel(): string {
        return Path.at("lib", "kernel.js");
    }

    static get images(): string {
        return Path.at("images");
    }
}

/**
 * @property {Boolean}  context.flag.debug    --ijs-debug
 * @property {String}   context.flag.install  --ijs-install=[local|global]
 * @property {String}   context.flag.specPath --ijs-spec-path=[none|full]
 * @property {String}   context.flag.startup  --ijs-startup-script=path
 * @property {String}   context.flag.cwd      --ijs-working-dir=path
 **/
enum InstallLoc {local, global}
enum SpecLoc {none, full}

class Flags {

    private static debug: boolean = false;
    private static install: InstallLoc;
    private static specPath: SpecLoc;
    private static startup: string;
    private static cwd: string;

    static toString() {
        return `
        FLAG: [debug? ${Flags.debug ? 'on' : 'off'}, 
               installAt: '${Flags.install}', 
               specAt: '${Flags.specPath}',
               startupScript: '${Flags.startup}',
               workingDirectory: '${Flags.cwd}']`;
    }

    static onDebug() {
        Flags.debug = true;
    }

    static set installAt(flag: string) {
        let loc = InstallLoc[flag];
        if (!loc) {
            Logger.throwAndExit(true, false, "Invalid flag for install location", flag);
        }
        Flags.install = loc;
    }

    static set specAt(flag: string) {
        let loc = SpecLoc[flag];
        if (!loc) {
            Logger.throwAndExit(true, false, "Invalid flag for spec location", flag);
        }
        Flags.specPath = loc;
    }

    static set startUpScript(script: string) {
        Flags.startup = script;
    }

    static set workingDir(loc: string) {
        Flags.cwd = loc;
    }

    static get spec() {
        return Flags.specPath;
    }

    static get startScript() {
        return Flags.startup;
    }

    static get working() {
        return Flags.cwd;
    }

    static get installPath() {
        return Flags.install;
    }
}

/**
 * @property {String[]} context.args.kernel   Command arguments to run kernel
 * @property {String[]} context.args.frontend Command arguments to run frontend
 **/
class Arguments {
    private static _kernel: string[] = [];
    private static _frontend: string[] = [
        "jupyter",
        "notebook",
    ];

    static toString() {
        return `
        KernelArgs: [${Arguments._kernel.join(',')}],
        FrontendArgs: [${Arguments._frontend.join(',')}]`;
    }

    static get kernel() {
        return Arguments._kernel;
    }

    static get frontend() {
        return Arguments._frontend;
    }

    static passToKernel(...args: string[]) {
        Arguments._kernel.push(args.join('='));
    }

    static passToFrontend(...args: string[]) {
        Arguments._frontend.push(args.join('='));
    }

    static prefixOfKernel(...args: string[]) {
        Arguments._kernel = args.concat(Arguments._kernel);
    }

    static callFrontendWith(path: string) {
        Arguments._frontend[0] = path;
    }
}

/**
 * @property {String}   context.protocol.version      Protocol version
 * @property {Integer}  context.protocol.majorVersion Protocol major version
 **/
class Protocol {
    private static _version: string;
    private static _majorVersion: number;

    static toString() {
        return `
        PROTOCOL: version ${Protocol._version}`;
    }

    static set version(ver: string) {
        Protocol._version = ver;
        Protocol._majorVersion = parseInt(ver.split(".", 1)[0]);
    }

    private static setup() {
        if (!Protocol._version) {
            if (Frontend.majorVersion < 3) {
                Protocol.version = "4.1";
            } else {
                Protocol.version = "5.0";
            }
        }
    }

    static get version() {
        Protocol.setup();
        return Protocol._version;
    }

    static get majorVersion() {
        Protocol.setup();
        return Protocol._majorVersion;
    }
}

/**
 * @property {Error}    context.frontend.error        Frontend error
 * @property {String}   context.frontend.version      Frontend version
 * @property {Integer}  context.frontend.majorVersion Frontend major version
 **/
class Frontend {
    static error: Error;
    private static _version: string;
    private static _majorVersion: number;

    static toString() {
        return `
        FRONTEND: version ${Frontend._version}
                  error: ${Frontend.error ? Frontend.error : 'NO ERROR' }`;
    }

    static set version(ver: string) {
        Frontend._version = ver;
        Frontend._majorVersion = parseInt(ver.split(".")[0]);

        if (isNaN(Frontend.majorVersion)) {
            Logger.throwAndExit(false, true,
                "Error parsing Jupyter/Ipython version:",
                ver
            );
        }
    }

    static get version() {
        return Frontend._version;
    }

    static get majorVersion() {
        return Frontend._majorVersion;
    }
}

/**
 * @typedef Main
 *
 * @property            context
 * @property            context.path
 * @property            context.flag
 * @property            context.args
 * @property            context.protocol
 * @property            context.frontend
 */
class Main {
    static readonly packageJSON: {version: string} = JSON.parse(
        fs.readFileSync(Path.at("package.json"))
    );

    static prepare(callback?: () => void) {
        let extraArgs: string[] = process.argv.slice(2);

        for (let e in extraArgs) {
            let [name, values] = e.slice(2).split('=');
            if (name.lastIndexOf("its", 0) === 0) {
                switch (name) {
                    case 'help':
                        Logger.printUsage();
                        Arguments.passToFrontend(e);
                        break;
                    case 'its-debug':
                        Logger.onVerbose();
                        Flags.onDebug();
                        Arguments.passToKernel("--debug");
                        break;
                    case 'its-help':
                        Logger.printUsage();
                        process.exit(0);
                        break;
                    case 'its-hide-undefined':
                        Arguments.passToKernel("--hide-undefined");
                        break;
                    case 'its-install':
                        Flags.installAt = values[0];
                        break;
                    case 'its-install-kernel':
                        Flags.installAt = 'local';
                        break;
                    case 'its-protocol':
                        Protocol.version = values[0];
                        break;
                    case 'its-show-undefined':
                        Arguments.passToKernel('--show-undefined');
                        break;
                    case 'its-spec-path':
                        Flags.specAt = values[0];
                        break;
                    case 'its-startup-script':
                        Flags.startUpScript = values.join('=');
                        break;
                    case 'its-working-dir':
                        Flags.workingDir = values.join('=');
                        break;
                    default:
                        Logger.throwAndExit(true, false, "Unknown flag", e);
                }
            } else {
                switch (name) {
                    case 'version':
                        console.log(Main.packageJSON.version);
                        process.exit(0);
                        break;
                    case 'KernelManager.kernel_cmd':
                        console.warn(`Warning: Flag '${ e }' skipped`);
                        break;
                    default:
                        Arguments.passToFrontend(e);
                }
            }
        }

        if (Flags.spec == SpecLoc.full) {
            Arguments.prefixOfKernel(Path.node, Path.kernel);
        } else {
            Arguments.prefixOfKernel((process.platform === 'win32') ? 'itskernel.cmd' : 'itskernel');
        }

        if (Flags.startScript) {
            Arguments.passToKernel('--startup-script', Flags.startScript);
        }

        if (Flags.working) {
            Arguments.passToKernel('--session-working-dir', Flags.working);
        }

        Arguments.passToKernel('{connection_file}');

        if(callback){
            callback();
        }
    }

    static setProtocol() {
        Arguments.passToKernel('--protocol=', Protocol.version);

        if (Frontend.majorVersion < 3) {
            Arguments.passToFrontend(
                '--KernelManager.kernel_cmd', `['${ Arguments.kernel.join("', '") }']`,
            );
        }

        if (Frontend.majorVersion < 3 &&
            Protocol.majorVersion >= 5) {
            console.warn("Warning: Protocol v5+ requires Jupyter v3+");
        }
    }

    static setJupyterInfoAsync(callback?: () => void) {
        exec("jupyter --version", function (error, stdout, stderr) {
            if (error) {
                Frontend.error = error;
                Main.setIPythonInfoAsync(callback);
                return;
            }

            Arguments.callFrontendWith("jupyter");
            Frontend.version = stdout.toString().trim();

            if (callback) {
                callback();
            }
        });
    }

    static setIPythonInfoAsync(callback?: () => void) {
        exec("ipython --version", function (error, stdout, stderr) {
            if (error) {
                if (Frontend.error) {
                    console.error("Error running `jupyter --version`");
                    console.error(Frontend.error.toString());
                }
                Logger.throwAndExit(false, true,
                    "Error running `ipython --version`\n",
                    error.toString()
                );
            }

            Arguments.callFrontendWith("ipython");
            Frontend.version = stdout.toString().trim();

            if (callback) {
                callback();
            }
        });
    }

    static makeTmpdir(maxAttempts: number = 10): string {
        let attempts = 0;
        let tmpdir: string;

        while (!tmpdir) {
            attempts++;
            try {
                tmpdir = path.join(os.tmpdir(), uuid.v4());
                fs.mkdirSync(tmpdir);
            } catch (e) {
                if (attempts >= maxAttempts) {
                    Logger.throwAndExit(false, false, "Cannot make a temp directory!");
                }
                tmpdir = null;
            }
        }

        return tmpdir;
    }

    static copyAsync(callback?: () => void, ...pair:[string, string][]) {
        let callStack: (() => void)[] = [];
        if(callback){
            callStack.push(callback);
        }

        for(let [src, dst] in pair){
            callStack.push(function() {
                let readStream = fs.createReadStream(src);
                let writeStream = fs.createWriteStream(dst);
                readStream.on("end", function(){
                    let top = callStack.pop();
                    top();
                });
                readStream.pipe(writeStream);
            });
        }

        let top = callStack.pop();
        top();
    }

    static installKernelAsync(callback?: () => void) {
        if (Frontend.majorVersion < 3) {
            if (Flags.installPath) {
                console.error(
                    "Error: Installation of kernel specs requires Jupyter v3+"
                );
            }

            if (callback) {
                callback();
            }

            return;
        }

        // Create temporary spec folder
        let tmpdir = Main.makeTmpdir();
        let specDir = path.join(tmpdir, "typescript");
        fs.mkdirSync(specDir);

        // Create spec file
        let specFile = path.join(specDir, "kernel.json");
        let spec = {
            argv: Arguments.kernel,
            display_name: "Typescript (TSUN)",
            language: "typescript",
        };
        fs.writeFileSync(specFile, JSON.stringify(spec));

        // Copy logo files
        let logoDir = path.join(Path.images, "nodejs");
        let logo32: [string, string] = [
            path.join(logoDir, "js-green-32x32.png"),
            path.join(specDir, "logo-32x32.png")
        ];
        let logo64: [string, string] = [
            path.join(logoDir, "js-green-64x64.png"),
            path.join(specDir, "logo-64x64.png")
        ];
        Main.copyAsync(function () {
                // Install kernel spec
                let args = [
                    Arguments.frontend[0],
                    "kernelspec install --replace",
                    specDir,
                ];

                if (Flags.installPath !== InstallLoc.global) {
                    args.push("--user");
                }

                var cmd = args.join(" ");
                exec(cmd, function (error, stdout, stderr) {
                    // Remove temporary spec folder
                    fs.unlinkSync(specFile);
                    fs.unlinkSync(logo32[1]);
                    fs.unlinkSync(logo64[1]);
                    fs.rmdirSync(specDir);
                    fs.rmdirSync(tmpdir);

                    if (error) {
                        Logger.throwAndExit(
                            false, true,
                            `Error running '${cmd}'\n`,
                            error.toString(),
                            '\n',
                            stderr ? stderr.toString() : ''
                        );
                    }

                    if (callback) {
                        callback();
                    }
                });
        }, [logo32, logo64]);
    }

    static spawnFrontend() {
        let [cmd, ...args] = Arguments.frontend;
        var frontend = spawn(cmd, args, {
            stdio: "inherit"
        });

        // Relay SIGINT onto the frontend
        var signal = "SIGINT";
        process.on(signal, function () {
            frontend.emit(signal);
        });
    }
}

if (process.env.DEBUG) {
    Logger.onProcessDebug();
}

/**
 * Script context
 * @type Main
 */
Main.prepare(function() {
    Main.setJupyterInfoAsync(function () {
        Main.setProtocol();
        Main.installKernelAsync(function () {
            Logger.printContext();

            if (!Flags.installPath) {
                Main.spawnFrontend();
            }
        });
    });
});