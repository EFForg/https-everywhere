// Copyright 2017-2018 AJ Jordan, AGPLv3+

'use strict';

const alexaLabels = ['top-100', 'top-1k', 'top-10k', 'top-100k', 'top-1m'];
const typeLabels = ['bug', 'enhancement', 'ruleset-bug', 'new-ruleset'];
const typeToLabel = {
  'code issue': 'bug',
  'feature request': 'enhancement',
  'ruleset issue': 'ruleset-bug',
  'new ruleset': 'new-ruleset'
};

module.exports = function label(context, data, alexa) {
  const alexaPosition = alexa.data.indexOf(data.domain);
  const labels = [];

  if (alexaPosition === -1) {
    // Do nothing, we still need to label the type
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

  const typeLabel = typeToLabel[data.type] || null;
  if (typeLabel) {
    labels.push(typeLabel);
  }

  // Every Alexa label *except* our new one, and the same for type labels
  const toRemove = alexaLabels.filter(label => label !== labels[0] || '')
                              .concat(typeLabels.filter(label => label !== typeLabel)); // eslint-disable-line indent

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
