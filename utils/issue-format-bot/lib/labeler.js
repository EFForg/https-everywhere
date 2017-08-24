// Copyright 2017 AJ Jordan, AGPLv3+

'use strict';

module.exports = function label(context, data, alexa) {
  const alexaPosition = alexa.indexOf(data.domain);
  const labels = [];

  // TODO remove existing labels in case of edits

  if (alexaPosition === -1) {
    return;
  } else if (alexaPosition < 100) {
    labels.push('top-100');
  } else if (alexaPosition < 1000) {
    labels.push('top-1k');
  } else if (alexaPosition < 10000) {
    labels.push('top-10k');
  } else if (alexaPosition < 100000) {
    labels.push('top-100k');
  } else if (alexaPosition < 1000000) {
    labels.push('top-1m');
  }

  const params = context.issue({labels});
  return context.github.issues.addLabels(params);
};
