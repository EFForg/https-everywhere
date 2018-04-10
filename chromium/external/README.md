# External dependencies

This directory contains files that are external dependencies for HTTPS Everywhere, with instructions on how to get or remake them.

## CodeMirror 5.31.0

```
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

```
$ npm install pako@1.0.5
```

### pako_inflate.min.js

```
$ cp node_modules/pako/dist/pako_inflate.js pako-1.0.5/pako_inflate.min.js
```

## Bowser 1.9.3

```bash
curl -L -o bowser.js https://github.com/lancedikson/bowser/releases/download/1.9.3/bowser.js

openssl dgst -sha256 bowser.js
# SHA256(bowser.js)= 0de3decea68d298502b5db3ea16524840ac3e5185108d6071625e38c0732b0c1

npm install uglify-js@3.1.9

uglifyjs --compress --mangle --comments '/copyright"|"license/i' --output bowser.min.js bowser.js
```
