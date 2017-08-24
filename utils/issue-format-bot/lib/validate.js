// Copyright 2017 AJ Jordan, AGPLv3+

'use strict';

module.exports = function validate(data) {
  const problems = [];

  // Validate that the user submitted all necessary data based on submission type
  switch (data.type) {
  case 'new ruleset':
    if (!data.domain) problems.push('Submission is missing domain information');
    break;
  case 'ruleset issue':
    if (!data.domain) problems.push('Submission is missing domain information');
    break;
  }

  return problems;
};
