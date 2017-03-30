# HTTPS Everywhere Labeller

This compares the open PR requests that have ruleset changes to the Alexa top 1M sites, and adds labels corresponding to how they place within Alexa.  Current labels are:

1. `top-100`
2. `top-1k`
3. `top-10k`
4. `top-100k`
5. `top-1m`

This will work for admins of HTTPS Everywhere that generate a [GitHub token](https://github.com/settings/tokens).

## Setup

### With Docker

    docker build -t labeller .

### Without Docker

Download and install `node` and `npm`, then

    npm install
    cp config.json.example config.json

Enter your GitHub token info into `config.json`.

## Running

### With Docker

Set your `$GITHUB_TOKEN`, and run

    docker run -it -v $(pwd)/state_dir:/opt/state_dir -e GITHUB_TOKEN=$GITHUB_TOKEN labeller

### Without Docker

    node index.js
