'use strict';

const vows = require('perjury'),
      handlerutil = require('./lib/handlerutil');

vows.describe('issue edit handler').addBatch(
	handlerutil.setup('../../lib/issueedit', {
		'and we pass it the context of an issue edit with a null body': handlerutil.nullBody('don\'t see any text'),
		'and we pass it the context of a issue edit with a bad type': handlerutil.badType('type of issue'),
		'and we pass it the context of a issue edit with a type of "new ruleset" and a correct body': handlerutil.correctNewRuleset('Type: new ruleset\nDomain: domain10.com', 'take it from here', 'take it from here'),
		'and we pass it the context of a issue edit with a type of "new ruleset" and a correct body with freeform comments': handlerutil.correctNewRuleset('Type: new ruleset\nDomain:domain10.com\nAnd let me say, what a great GitHub bot HTTPS Everywhere has!', 'take it from here'),
		'and we pass it the context of a issue edit with a type of "new ruleset" and a problematic body': handlerutil.problematicNewRuleset('missing domain information')
	})
).export(module);
