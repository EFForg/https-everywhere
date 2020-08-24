# Labels Pull Requests With Top Alexa Site Rankings
![Pull request labeler](https://github.com/EFForg/https-everywhere/workflows/Pull%20request%20labeler/badge.svg)

Based off of `utils/labeller`
See: https://github.com/EFForg/https-everywhere/blob/master/utils/labeller/README.md

# Build
Utilizes https://www.npmjs.com/package/@vercel/ncc to offset node_modules reference burden
```bash
npm i -g @vercel/ncc
ncc build index.js -o dist
```

# Notes About Testing
At the time of writing this, the only way to test is to create a test PR and commit there with console logs from the job ran in Actions tab. 

There is a tool that allegedly tests Github Actions locally, but it's not an official tool and very unstable:
https://github.com/nektos/act
