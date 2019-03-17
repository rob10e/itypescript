# ITypescript

ITypescript is an [`npm` package](https://www.npmjs.com/) that implements a
TypeScript kernel for the [Jupyter notebook](http://jupyter.org/), as a modification of
[IJavascript kernel](http://n-riesco.github.io/ijavascript). A Jupyter
notebook combines the creation of rich-text documents (including equations,
graphs and videos) with the execution of code in a number of programming
languages.

The execution of code is carried out by means of a kernel that implements the
[IPython/Jupyter messaging
protocol](http://jupyter-client.readthedocs.io/en/latest/messaging.html).
There are kernels available for [Python](http://ipython.org/notebook.html),
[Julia](https://github.com/JuliaLang/IJulia.jl),
[Ruby](https://github.com/minad/iruby),
[Haskell](https://github.com/gibiansky/IHaskell) and [many
other languages](https://github.com/ipython/ipython/wiki/IPython-kernels-for-other-languages).

Again, We have to emphasize these code is originally come from [IJavascript kernel](http://n-riesco.github.io/ijavascript). 
We converted the code into typescript, and modified tiny fraction of it.

## Main Features

- Run TypeScript code within a `node.js` session

Following examples are translation of [IJavascript](http://n-riesco.github.io/ijavascript)'s
examples, from javascript to typescript.

- [Hello, World!](https://github.com/nearbydelta/itypescript/tree/master/doc/hello.ipynb)
- [Graphical
  output](https://github.com/nearbydelta/itypescript/tree/master/doc/graphics.ipynb) for
  `HTML`, `SVG`, `PNG`, ...
- [Asynchronous
  output](https://github.com/nearbydelta/itypescript/tree/master/doc/async.ipynb)
- [Autocompletion](https://github.com/nearbydelta/itypescript/tree/master/doc/Completion.Inspection.ipynb):
  press `TAB` to complete keywords and object properties
- [Object
  inspection](https://github.com/nearbydelta/itypescript/tree/master/doc/Completion.Inspection.ipynb): press
  `Shift-TAB` to inspect an object and show its content or, if available, its
  documentation

## Installations

### Prerequisites
If you're using Typescript, you should install `node.js` first.
Follow the instruction of [Node.js Download page](https://nodejs.org/en/download/) or
[Node.js Installation page](https://nodejs.org/en/download/package-manager/).

Also, you have to install `jupyter`. Follow the instruction of
[Installing Jupyter notebook](http://jupyter.readthedocs.io/en/latest/install.html).

### Stand-alone
After installing these, install ITypescript by typing following shell command (Linux/Unix/Mac):
```sh
sudo -H npm install -g itypescript
```
For windows, find `node.js prompt`, run it as administrator, and type:
```sh
npm install -g itypescript
```

### Jupyter Kernel
You can install `itypescript` kernel globally with the following command:
```sh
sudo -H its --install=global
```
Or you can install it locally:
```sh
its --install=local
```

For further usage, check [usage.md](https://github.com/nearbydelta/itypescript/blob/master/doc/usage.md)

# Contributions

First of all, thank you for taking the time to contribute. Please, read
[CONTRIBUTING](http://github.com/nearbydelta/itypescript/blob/master/CONTRIBUTING.md) and use
the [issue tracker](http://github.com/nearbydelta/itypescript/issues) for any
contributions: support requests, bug reports, enhancement requests, pull
requests, submission of tutorials...
