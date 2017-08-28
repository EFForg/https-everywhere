// Copyright 2017 AJ Jordan, AGPLv3+

'use strict';

const vows = require('perjury'),
  handlerutil = require('./lib/handlerutil');

vows.describe('new issue handler').addBatch(
  handlerutil.setup('../../lib/newissue', {
    'and we pass it the context of a new issue with a null body': handlerutil.nullBody('can\'t find any text'),
    'and we pass it the context of a new issue with a bad type': handlerutil.badType('type of issue'),
    'and we pass it the context of a new issue with a type of "new ruleset" and a correct body': handlerutil.correctNewRuleset('Type: new ruleset\nDomain: domain10.com'),
    'and we pass it the context of a new issue with a type of "new ruleset" and a problematic body': handlerutil.problematicNewRuleset('missing domain information'),
    'and we pass it the context of a new issue with multiple types': handlerutil.multipleTypes('more than one type'),
    'and we pass it the context of a new issue with no type': handlerutil.noType('find the type of issue')
  })
).export(module);
