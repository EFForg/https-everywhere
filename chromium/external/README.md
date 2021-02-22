# External dependencies

This directory contains files that are external dependencies for HTTPS Everywhere, with instructions on how to get or remake them.

## CodeMirror 5.31.0

```bash
$ npm install uglify-js@3.1.9
$ npm install uglifycss@0.0.27
$ curl -o codemirror.zip https://codemirror.net/codemirror-5.31.0.zip
$ unzip codemirror.zip
```

### codemirror-5.31.0.min.js

```bash
uglifyjs \
  --compress \
  --mangle \
  --comments '/copyright|license/' \
  --output codemirror-5.31.0.min.js \
  codemirror-5.31.0/lib/codemirror.js
```

### codemirror-5.31.0.xml.min.js

```bash
uglifyjs \
  --compress \
  --mangle \
  --comments '/copyright|license/' \
  --output codemirror-5.31.0.xml.min.js \
  codemirror-5.31.0/mode/xml/xml.js
```

### codemirror-5.31.0.min.css

```bash
uglifycss \
  --output codemirror-5.31.0.min.css \
  codemirror-5.31.0/lib/codemirror.css
```

## Pako 1.0.5

`$ npm install pako@1.0.5`

### pako_inflate.min.js

```bash

$ cp node_modules/pako/dist/pako_inflate.js pako-1.0.5/pako_inflate.min.js
