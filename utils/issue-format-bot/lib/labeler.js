// Copyright 2017 AJ Jordan, AGPLv3+

'use strict';

const alexaLabels = ['top-100', 'top-1k', 'top-10k', 'top-100k', 'top-1m'];

module.exports = function label(context, data, alexa) {
  const alexaPosition = alexa.data.indexOf(data.domain);
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

  // Every Alexa label *except* our new one
  const toRemove = alexaLabels.filter(label => label !== labels[0]);
  toRemove.forEach(label => {
    const removalParams = context.issue({name: label});
    // This is racy with addLabels() but honestly who cares
    context.github.issues.removeLabel(removalParams).catch(err => {
      // GitHub returns 404 if the label doesn't exist on the issue, so we just swallow those errors
      // XXX should we query labels and do a diff?
      if (err.code === 404) return;

      throw err;
    });
  });

  const params = context.issue({labels});
  return context.github.issues.addLabels(params);
};
