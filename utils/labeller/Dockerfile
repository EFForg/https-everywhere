FROM node:10-alpine
LABEL maintainer="Alexis Hancock <alexis@eff.org>"

WORKDIR /opt

COPY package.json .
RUN npm install
COPY index.js .
COPY utils.js .
COPY test.js .
COPY config.json.example .
RUN mv config.json.example config.json

CMD ["node", "index.js"]
