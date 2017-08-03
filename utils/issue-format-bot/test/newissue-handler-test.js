'use strict';

const vows = require('perjury'),
      assert = vows.assert,
      makeContext = require('./mocks/context'),
      handlerutil = require('./lib/handlerutil');

vows.describe('new issue handler').addBatch(
	handlerutil.setup('../../lib/newissue', {
		'and we pass it the context of a new issue with a null body': handlerutil.nullBody('can\'t find any text'),
		'and we pass it the context of a new issue with a bad type': handlerutil.badType('type of issue'),
		'and we pass it the context of a new issue with a type of "new ruleset" and a correct body': handlerutil.correctNewRuleset,
		// Problematic bodies aren't tested extensively here because that validation will eventually be refactored into another module and tested there
		'and we pass it the context of a new issue with a type of "new ruleset" and a problematic body': handlerutil.problematicNewRuleset('missing domain information')
	})
).export(module);
