# HTTPS Rewriter

Uses the rulesets from HTTPS to recursively rewrite URL references in a
given directory to HTTPS. Uses protocol-relative URLs wherever possible.
Makes a copy of each file at filename.bak.

## Install

```Shell
cd https-everywhere
./install-dev-dependencies.sh
./make.sh # to build default.rulesets
cd utils/rewriter/
npm install
```

## Usage

```Shell
./rewriter.js ~/path/to/my/webapp
cd ~/path/to/my/webapp
git diff
```
