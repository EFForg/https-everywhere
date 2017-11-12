# issue-format-bot

> a GitHub Integration built with [probot](https://github.com/probot/probot) that parses incoming HTTPS Everywhere ruleset bugs

## About

This bot enforces consistency in HTTPS Everywhere issues. All issues are required to have a "type", and for ruleset bugs and new rulesets, the bot also requires issues to have a machine-readable domain.

It then uses this information to label the issue appropriately (e.g. with `top-100`, `top-1k`, etc.).

All the fields are set up in the issue template, so users shouldn't have any trouble if they just follow the instructions they're presented when filing a new issue. That being said, if the bot encounters an error, it will post a comment telling the user what the error was and suggesting they edit their issue. Once the issue is edited, the bot will recognize this and will reparse the issue, posting any followup comments as necessary (in case it encounters more problems).

## Setup

```
# Install dependencies
npm install

# Run the bot
npm start
```

See [docs/deploy.md](docs/deploy.md) if you would like to run your own instance of this plugin.
