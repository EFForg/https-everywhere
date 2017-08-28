// Copyright 2017 AJ Jordan, AGPLv3+

'use strict';

const vows = require('perjury'),
  handlerutil = require('./lib/handlerutil');

vows.describe('issue edit handler').addBatch(
  handlerutil.setup('../../lib/issueedit', {
    'and we pass it the context of an issue edit with a null body': handlerutil.nullBody('don\'t see any text'),
    'and we pass it the context of a issue edit with a bad type': handlerutil.badType('type of issue'),
    'and we pass it the context of a issue edit with a type of "new ruleset" and a correct body': handlerutil.correctNewRuleset('Type: new ruleset\nDomain: domain10.com', 'take it from here', 'take it from here'),
    'and we pass it the context of a issue edit with a type of "new ruleset" and a problematic body': handlerutil.problematicNewRuleset('missing domain information'),
    'and we pass it the context of a new issue with multiple types': handlerutil.multipleTypes('more than one type'),
    'and we pass it the context of a new issue with no type': handlerutil.noType('see the type of issue')
  })

).export(module);
