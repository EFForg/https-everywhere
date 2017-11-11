'use strict'

const assert = require('chai').assert,
  rules = require('../rules');

const Exclusion = rules.Exclusion,
  Rule = rules.Rule,
  RuleSet = rules.RuleSet,
  RuleSets = rules.RuleSets;


describe('rules.js', function() {
  let test_str = 'test';

  describe('nullIterable', function() {
    it('is iterable zero times and is size 0', function() {
      let count = 0;
      for (let _ of rules.nullIterable) { // eslint-disable-line no-unused-vars
        count += 1;
      }
      assert.strictEqual(count, 0);
      assert.strictEqual(rules.nullIterable.size,  0);
      assert.isEmpty(rules.nullIterable);
    });
  });

  describe('Exclusion', function() {
    it('constructs', function() {
      let exclusion = new Exclusion(test_str);
      assert.isTrue(exclusion.pattern_c.test(test_str), true);
    });
  });

  describe('Rule', function() {
    it('constructs trivial rule', function() {
      let rule = new Rule('^http:', 'https:');
      assert.equal(rule.to, rules.trivial_rule_to);
      assert.equal(rule.from_c, rules.trivial_rule_from_c);
    });
  });

  describe('RuleSet', function() {
    beforeEach(function() {
      this.ruleset = new RuleSet('set_name', true, 'note');
    });

    describe('#apply', function() {
      it('excludes excluded uris', function() {
        this.ruleset.exclusions = [new Exclusion(test_str)];
        assert.isNull(this.ruleset.apply(test_str));
      });

      it('rewrites uris', function() {
        let rule = new Rule('^http:', 'https:');
        this.ruleset.rules.push(rule);
        assert.equal(this.ruleset.apply('http://example.com/'), 'https://example.com/');
      });

      it('does nothing when empty', function() {
        assert.isNull(this.ruleset.apply('http://example.com/'));
      });
    });

    describe('#isEquivalentTo', function() {
      let inputs = ['a', 'b', 'c'];

      it('not equivalent with different input', function() {
        let rs = new RuleSet(...inputs);
        assert.isFalse(
          rs.isEquivalentTo(new RuleSet('e', 'f', 'g'))
        );
      });
      it('not equivalent with different exclusions', function() {
        let rs_a = new RuleSet(...inputs),
          rs_b = new RuleSet(...inputs);
        rs_a.exclusions = [new Exclusion('foo')];
        rs_b.exclusions = [new Exclusion('bar')];

        assert.isFalse(rs_a.isEquivalentTo(rs_b));
      });

      it('not equivalent with different rules', function() {
        let rs_a = new RuleSet(...inputs),
          rs_b = new RuleSet(...inputs);
        rs_a.rules.push(new Rule('a', 'a'));
        rs_b.rules.push(new Rule('b', 'b'));

        assert.isFalse(rs_a.isEquivalentTo(rs_b));
      });

      it('equivalent to self', function() {
        let rs = new RuleSet(...inputs);
        assert.isTrue(rs.isEquivalentTo(rs));
      });
    });
  })

  describe('RuleSets', function() {
    let rules_json = [{
      name: "Freerangekitten.com",
      rule: [{
        to: "https:",
        from: "^http:"
      }],
      target: ["freerangekitten.com", "www.freerangekitten.com"]
    }];

    beforeEach(function() {
      this.rsets = new RuleSets();
    });

    describe('#addFromJson', function() {
      it('can add a rule', function() {
        this.rsets.addFromJson(rules_json);

        assert.isTrue(this.rsets.targets.has('freerangekitten.com'));
      });
    });

    describe('#rewriteURI', function() {
      it('rewrites host added from json', function() {
        let host = 'freerangekitten.com';
        this.rsets.addFromJson(rules_json);

        let newuri = this.rsets.rewriteURI('http://' + host + '/', host);

        assert.strictEqual(newuri, 'https://' + host + '/', 'protocol changed to https')
      })

      it('does not rewrite unknown hosts', function() {
        assert.isNull(this.rsets.rewriteURI('http://unknown.com/', 'unknown.com'));
      })
    });

    describe('#potentiallyApplicableRulesets', function() {
      let host = 'example.com',
        value = [host];

      it('returns nothing when empty', function() {
        assert.isEmpty(this.rsets.potentiallyApplicableRulesets(host));
      });

      it('returns nothing for malformed hosts', function() {
        assert.isEmpty(this.rsets.potentiallyApplicableRulesets('....'));
      });

      it('returns nothing for empty hosts', function() {
        assert.isEmpty(this.rsets.potentiallyApplicableRulesets(''));
      });

      it('returns cached rulesets', function() {
        this.rsets.ruleCache.set(host, value);
        assert.deepEqual(this.rsets.potentiallyApplicableRulesets(host), value);
      });

      it('caches results', function() {
        this.rsets.targets.set(host, value);

        assert.isEmpty(this.rsets.ruleCache);
        this.rsets.potentiallyApplicableRulesets(host);
        assert.isTrue(this.rsets.ruleCache.has(host));
      });

      describe('wildcard matching', function() {

        it('no wildcard', function() {
          let target = host;
          this.rsets.targets.set(target, value);

          let result = this.rsets.potentiallyApplicableRulesets(target),
            expected = new Set(value);

          assert.deepEqual(result, expected);
        });

        it('matches left hand side wildcards', function() {
          let target = '*.' + host;
          this.rsets.targets.set(target, value);

          let res1 = this.rsets.potentiallyApplicableRulesets('sub.' + host);
          assert.deepEqual(res1, new Set(value), 'default case');

          let res2 = this.rsets.potentiallyApplicableRulesets(host);
          assert.isEmpty(res2, 'wildcard does not match parent domains');

          let res3 = this.rsets.potentiallyApplicableRulesets('moresub.sub.' + host);
          assert.deepEqual(res3, new Set(value), 'wildcard matches sub domains');
        });

        it('matches middle wildcards', function() {
          let target = 'sub.*.' + host;
          this.rsets.targets.set(target, value);

          let res1 = this.rsets.potentiallyApplicableRulesets('sub.star.' + host);
          assert.deepEqual(res1, new Set(value), 'default case');

          let res2 = this.rsets.potentiallyApplicableRulesets('sub.foo.bar.' + host);
          assert.isEmpty(res2, new Set(value), 'only matches one label');
        });
      });
    });
  });
})
