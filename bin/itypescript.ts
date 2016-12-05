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

import "console";
import {exec, spawn} from "child_process";
import "fs";
import "os";
import "path";
import "node-uuid";

let usage = `Itypescript Notebook

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

// Setup logging helpers
let DEBUG: boolean;

let log: () => void;
function dontLog() {};
function doLog() {
  process.stderr.write("IJS: ");
  console.error.apply(this, arguments);
};
function throwAndExit(msg: string) {
  console.error(
    `Error: Unknown flag option '${ msg }'\n`
  );
  console.error(usage);
  process.exit(1);
}

if (process.env.DEBUG) {
  DEBUG = true;

  try {
    import debug;
    doLog = debug("ITS:");
  } catch (err) {}
}

log = DEBUG ? doLog : dontLog;

/**
 * @property {String}   context.path.node     Path to Node.js shell
 * @property {String}   context.path.root     Path to IJavascript root folder
 * @property {String}   context.path.kernel   Path to IJavascript kernel
 * @property {String}   context.path.images   Path to IJavascript images folder
 * @property {Object}   context.packageJSON   Contents of npm package.json
 **/
class ShellPath{
  readonly node: string;
  readonly root: string;
  
  constructor(node: String, root: String){
    this.node = node;
    this.root = root;
  }

  get kernel(): string {
    return path.join(root, "lib", "kernel.js");
  }
  
  get images(): string {
    return path.join(root, "images");
  }
}

/**
 * @property {Boolean}  context.flag.debug    --ijs-debug
 * @property {String}   context.flag.install  --ijs-install=[local|global]
 * @property {String}   context.flag.specPath --ijs-spec-path=[none|full]
 * @property {String}   context.flag.startup  --ijs-startup-script=path
 * @property {String}   context.flag.cwd      --ijs-working-dir=path
 **/
class ShellFlags{
  debug: boolean = false;
  install: string;
  specPath: string;
  startup: string;
  cwd: string;
}

/**
 * @property {String[]} context.args.kernel   Command arguments to run kernel
 * @property {String[]} context.args.frontend Command arguments to run frontend
 **/
class ShellArgs{
  kernel: string[] = [];
  frontend: string[] = [
      "jupyter",
      "notebook",
    ];
}

/**
 * @property {String}   context.protocol.version      Protocol version
 * @property {Integer}  context.protocol.majorVersion Protocol major version
 **/
class ProtocolSpec{
  version?: string;
  majorVersion?: number;
}

/**
 * @property {Error}    context.frontend.error        Frontend error
 * @property {String}   context.frontend.version      Frontend version
 * @property {Integer}  context.frontend.majorVersion Frontend major version
 **/
interface FrontendSpec{
  error?: Error;
  version?: string;
  majorVersion?: number;
}

/**
 * @typedef Context
 *
 * @property            context
 * @property            context.path
 * @property            context.flag
 * @property            context.args
 * @property            context.protocol
 * @property            context.frontend
 */
class Context{
  readonly paths: ShellPath;
  readonly packageJSON: Object;
  flag: ShellFlag;
  args: ShellArgs;
  protocol: ProtocolSpec;
  frontend: FrontendSpec;

  constructor() {
    this.path = new ShellPath(
      process.argv[0], 
      path.dirname(path.dirname(
        fs.realpathSync(process.argv[1])
      ))
    );
    
    this.packageJSON = JSON.parse(
      fs.readFileSync(path.join(paths.root, "package.json"))
    );

    args = new ShellArgs();
    flag = new ShellFlags();
    protocol = new ProtocolSpec();
    
    process.argv.slice(2).forEach(function(e: string) {
      if (e === "--help") {
        console.log(usage);
        args.frontend.push(e);

      } else if (e === "--ijs-debug") {
        DEBUG = true;
        log = doLog;

        flag.debug = true;
        args.kernel.push("--debug");

      } else if (e === "--ijs-help") {
        console.log(usage);
        process.exit(0);

      } else if (e === "--ijs-hide-undefined") {
        args.kernel.push("--hide-undefined");
        
      } else if (e.lastIndexOf("--ijs-install=", 0) === 0) {
        flag.install = e.slice(14);
        if (flag.install !== "local" &&
            flag.install !== "global") {
          throwAndExit(e);
        }

      } else if (e === "--ijs-install-kernel") {
        flag.install = "local";

      } else if (e.lastIndexOf("--ijs-protocol=", 0) === 0) {
        let version = e.slice(15)
        protocol = {
          version: version,
          majorVersion: parseInt(
            version.split(".", 1)[0]
          )
        };

      } else if (e === "--ijs-show-undefined") {
        args.kernel.push("--show-undefined");

      } else if (e.lastIndexOf("--ijs-spec-path=", 0) === 0) {
        flag.specPath = e.slice(16);
        if (flag.specPath !== "none" &&
            flag.specPath !== "full") {
          throwAndExit(e);
        }

      } else if (e.lastIndexOf("--ijs-startup-script=", 0) === 0) {
        flag.startup = fs.realpathSync(e.slice(21));

      } else if (e.lastIndexOf("--ijs-working-dir=", 0) === 0) {
        flag.cwd = fs.realpathSync(e.slice(18));

      } else if (e.lastIndexOf("--ijs-", 0) === 0) {
        throwAndExit(e);

      } else if (e.lastIndexOf("--KernelManager.kernel_cmd=", 0) === 0) {
        console.warn(`Warning: Flag '${ e }' skipped`);

      } else if (e === "--version") {
        console.log(packageJSON.version);
        process.exit(0);
        
      } else {
        args.frontend.push(e);
      }
    });

    if (flag.specPath === "full") {
      args.kernel = [
        paths.node,
        paths.kernel,
      ].concat(args.kernel);
    } else {
      args.kernel = [
        (process.platform === 'win32') ? 'itskernel.cmd' : 'itskernel',
      ].concat(args.kernel);
    }

    if (flag.startup) {
      args.kernel.push("--startup-script=" + flag.startup);
    }

    if (flag.cwd) {
      args.kernel.push("--session-working-dir=" + flag.cwd);
    }

    args.kernel.push("{connection_file}");
  }
  
  setProtocol() {
    if (!protocol.version) {
      if (frontend.majorVersion < 3) {
        protocol.version = "4.1";
        protocol.majorVersion = 4;
      } else {
        protocol.version = "5.0";
        protocol.majorVersion = 5;
      }
    }

    args.kernel.push("--protocol=" + protocol.version);

    if (frontend.majorVersion < 3) {
      args.frontend.push(
        `--KernelManager.kernel_cmd=['${ args.kernel.join("', '") }']`,
      );
    }

    if (frontend.majorVersion < 3 &&
      protocol.majorVersion >= 5) {
      console.warn("Warning: Protocol v5+ requires Jupyter v3+");
    }
  }

  setJupyterInfoAsync(callback:() => void) {
    exec("jupyter --version", function(error, stdout, stderr) {
      if (error) {
        frontend = {error: error};
        context.setIPythonInfoAsync(callback);
        return;
      }

      args.frontend[0] = "jupyter";
      let jupyterVer = stdout.toString().trim();
      frontend = {version: jupyterVer, majorVersion: parseInt(jupyterVer.split(".")[0])};
      
      if (isNaN(frontend.majorVersion)) {
        console.error(
          "Error parsing Jupyter version:",
          version.frontend
        );
        log("CONTEXT:", this);
        process.exit(1);
      }

      if (callback) {
        callback();
      }
    });
  }

  setIPythonInfoAsync(callback: () => void) {
    exec("ipython --version", function(error, stdout, stderr) {
      if (error) {
        if (frontend.error) {
          console.error("Error running `jupyter --version`");
          console.error(frontend.error.toString());
        }
        console.error("Error running `ipython --version`");
        console.error(error.toString());
        log("CONTEXT:", this);
        process.exit(1);
      }

      args.frontend[0] = "ipython";
      
      let ipyVer = stdout.toString().trim();
      frontend = {version: ipyVer, majorVersion: parseInt(ipyVer.split(".")[0])};

      if (isNaN(frontend.majorVersion)) {
        console.error(
          "Error parsing IPython version:",
          version.frontend
        );
        log("CONTEXT:", this);
        process.exit(1);
      }

      if (callback) {
        callback();
      }
    });
  }

  installKernelAsync(callback: () => void) {
    if (frontend.majorVersion < 3) {
      if (flag.install) {
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
    let tmpdir = makeTmpdir();
    let specDir = path.join(tmpdir, "typescript");
    fs.mkdirSync(specDir);

    // Create spec file
    var specFile = path.join(specDir, "kernel.json");
    var spec = {
        argv: args.kernel,
        display_name: "Typescript (TSUN)",
        language: "typescript",
    };
    fs.writeFileSync(specFile, JSON.stringify(spec));

    // Copy logo files
    let logoDir = path.join(paths.images, "nodejs");
    let logo32Src = path.join(logoDir, "js-green-32x32.png");
    let logo32Dst = path.join(specDir, "logo-32x32.png");
    let logo64Src = path.join(logoDir, "js-green-64x64.png");
    let logo64Dst = path.join(specDir, "logo-64x64.png");
    copyAsync(logo32Src, logo32Dst, function() {
        copyAsync(logo64Src, logo64Dst, function() {

            // Install kernel spec
            var args = [
                context.args.frontend[0],
                "kernelspec install --replace",
                specDir,
            ];
            if (context.flag.install !== "global") {
                args.push("--user");
            }
            var cmd = args.join(" ");
            exec(cmd, function(error, stdout, stderr) {

                // Remove temporary spec folder
                fs.unlinkSync(specFile);
                fs.unlinkSync(logo32Dst);
                fs.unlinkSync(logo64Dst);
                fs.rmdirSync(specDir);
                fs.rmdirSync(tmpdir);

                if (error) {
                    console.error(util.format("Error running `%s`", cmd));
                    console.error(error.toString());
                    if (stderr) console.error(stderr.toString());
                    log("CONTEXT:", context);
                  process.exit(1);
                }

                if (callback) {
                    callback();
                }
            });
        });
    });
}

}

/**
 * Script context
 * @type Context
 */
let context: Context = new Context();

context.setJupyterInfoAsync(function() {
  context.setProtocol();

  context.installKernelAsync(function() {
    log("CONTEXT:", context);

    if (!context.flag.install) {
      spawnFrontend(context);
    }
  });
});


function spawnFrontend(context) {
    var cmd = context.args.frontend[0];
    var args = context.args.frontend.slice(1);
    var frontend = spawn(cmd, args, {
        stdio: "inherit"
    });

    // Relay SIGINT onto the frontend
    var signal = "SIGINT";
    process.on(signal, function() {
        frontend.emit(signal);
    });
}

function makeTmpdir(maxAttempts) {
    maxAttempts = maxAttempts ? maxAttempts : 10;
    var attempts = 0;

    var tmpdir;
    while (!tmpdir) {
        attempts++;
        try {
            tmpdir = path.join(os.tmpdir(), uuid.v4());
            fs.mkdirSync(tmpdir);
        } catch (e) {
            if (attempts >= maxAttempts)
                throw e;
            tmpdir = null;
        }
    }

    return tmpdir;
}

function copyAsync(src, dst, callback) {
    var readStream = fs.createReadStream(src);
    var writeStream = fs.createWriteStream(dst);
    if (callback) {
        readStream.on("end", callback);
    }
    readStream.pipe(writeStream);
}
