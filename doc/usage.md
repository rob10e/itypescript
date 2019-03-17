# Usage

To start an ITypescript session in the Jupyter notebook, simply run:

```sh
its
```

This command will open the Jupyter dashboard in your default web browser.

## Register ITypescript with the dashboard

The ITypescript kernel can be registered with Jupyter without
opening the dashboard. To register the kernel for all users, run:

```sh
its --install=global
```

and for the current user only:

```sh
its --install=local
```

## Set the dashboard home folder

By default, the dashboard lists the notebooks in the current working folder. The
flag `--notebook-dir=path/to/another/folder` can be used to open the dashboard
at a different folder:

```sh
its --notebook-dir=path/to/another/folder
```

## Set the kernel working folder

Also by default, the ITypescript kernel runs a `node.js` session in the current
working folder. The flag `--ts-working-dir=path/to/another/folder` can be used
to run the `node.js` session at a different folder.

## Run startup scripts

It is possible to run one or more scripts at the startup of an ITypescript
session. This can be useful to preload an `npm` package (e.g.
[d3](https://www.npmjs.com/package/d3)) or a [custom
`$$mimer$$`](http://n-riesco.github.io/ijavascript/doc/mimer.ipynb.html) provided by IJavascript kernel.

To preload a script:

```sh
its --ts-startup-script=path/to/script.js
```

For convenience, it is also possible to preload all the Javascript files in a
folder. The execution order is determined by the alphabetical order of their
filenames; for example: `50-package-d3.js`, `60-mimer-d3.js`.

```sh
its --ts-startup-script=path/to/folder
```

## Other command flags

Documentation on other flags can be found by running:

```sh
its --help
```

## Sample notebooks

More examples of use can be found on the [ITypescript
website](https://nearbydelta.github.io/itypescript/index.html).
