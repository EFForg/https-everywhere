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

vows.describe('new issue handler').addBatch(
	handlerutil.setup('../../lib/newissue', {
		'and we pass it the context of a new issue with a null body': handlerutil.nullBody('can\'t find any text'),
		'and we pass it the context of a new issue with a bad type': handlerutil.badType('type of issue'),
		'and we pass it the context of a new issue with a type of "new ruleset" and a correct body': handlerutil.correctNewRuleset('Type: new ruleset\nDomain: domain10.com'),
		'and we pass it the context of a issue edit with a type of "new ruleset" and a correct body with freeform comments': handlerutil.correctNewRuleset('Type: new ruleset\nDomain: domain10.com\nAnd let me say, what a great GitHub bot HTTPS Everywhere has!'),
		'and we pass it the context of a issue edit with a type of "new ruleset" and a correct body with a freeform comment with a colon': handlerutil.correctNewRuleset('Type: new ruleset\nDomain: domain10.com\nHere\'s a secret: I like colons.'),
		'and we pass it the context of a issue edit with a type of "new ruleset" and a correct body with a freeform comment with multiple colons': handlerutil.correctNewRuleset('Type: new ruleset\nDomain: domain10.com\nHere\'s a secret: I like colons. Another secret: I like them a lot.'),
		'and we pass it the context of a issue edit with a type of "new ruleset" and a correct body with a freeform comment with a Markdown link': handlerutil.correctNewRuleset('Type: new ruleset\nDomain: domain10.com\nPlease add [domain10.com][].\n\n [domain10.com]: http://domain10.com.'),
		'and we pass it the context of a new issue with a type of "new ruleset" and a problematic body': handlerutil.problematicNewRuleset('missing domain information')
	})
).export(module);
