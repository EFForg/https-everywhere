// Copyright 2017 AJ Jordan
//
// This file is part of the HTTPS Everywhere issue management bot.
//
// The HTTPS Everywhere issue management bot is free software: you can
// redistribute it and/or modify it under the terms of the GNU Affero
// General Public License as published by the Free Software
// Foundation, either version 3 of the License, or (at your option)
// any later version.
//
// The HTTPS Everywhere issue management bot is distributed in the
// hope that it will be useful, but WITHOUT ANY WARRANTY; without even
// the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR
// PURPOSE.  See the GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public
// License along with the HTTPS Everywhere issue management bot.  If
// not, see <http://www.gnu.org/licenses/>.

'use strict';

const vows = require('perjury'),
      handlerutil = require('./lib/handlerutil');

vows.describe('issue edit handler').addBatch(
	handlerutil.setup('../../lib/issueedit', {
		'and we pass it the context of an issue edit with a null body': handlerutil.nullBody('don\'t see any text'),
		'and we pass it the context of a issue edit with a bad type': handlerutil.badType('type of issue'),
		'and we pass it the context of a issue edit with a type of "new ruleset" and a correct body': handlerutil.correctNewRuleset('Type: new ruleset\nDomain: domain10.com', 'take it from here', 'take it from here'),
		'and we pass it the context of a issue edit with a type of "new ruleset" and a correct body with freeform comments': handlerutil.correctNewRuleset('Type: new ruleset\nDomain:domain10.com\nAnd let me say, what a great GitHub bot HTTPS Everywhere has!', 'take it from here'),
		'and we pass it the context of a issue edit with a type of "new ruleset" and a correct body with a freeform comment with a colon': handlerutil.correctNewRuleset('Type: new ruleset\nDomain: domain10.com\nHere\'s a secret: I like colons.', 'take it from here'),
		'and we pass it the context of a issue edit with a type of "new ruleset" and a correct body with a freeform comment with multiple colons': handlerutil.correctNewRuleset('Type: new ruleset\nDomain: domain10.com\nHere\'s a secret: I like colons. Another secret: I like them a lot.', 'take it from here'),
		'and we pass it the context of a issue edit with a type of "new ruleset" and a problematic body': handlerutil.problematicNewRuleset('missing domain information')
	})
).export(module);
