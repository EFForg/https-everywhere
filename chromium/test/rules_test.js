'use strict'

const assert = require('chai').assert,
  rules = require('../rules');

const Exclusion = rules.Exclusion,
  Rule = rules.Rule,
  RuleSet = rules.RuleSet,
  RuleSets = rules.RuleSets;


describe('rules.js', function() {
  let test_str = 'test';

  describe('Exclusion', function() {
    it('constructs', function() {
      let exclusion = new Exclusion(test_str);
      assert(exclusion.pattern_c.test(test_str), true);
    });
  });

  describe('Rule', function() {
    it('constructs trivial rule', function() {
      let rule = new Rule('^http:', 'https:');
      assert(rule.to, rules.trivial_rule_to);
      assert(rule.from_c, rules.trivial_rule_from);
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
        assert(this.ruleset.apply('http://example.com/'), 'https://example.com/');
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
    describe('#potentiallyApplicableRulesets', function() {
      let example_host = 'example.com';

      beforeEach(function() {
        this.rsets = new RuleSets();
      });

      it('returns nothing when empty', function() {
        assert.isEmpty(this.rsets.potentiallyApplicableRulesets(example_host));
      });

      it('returns cached rulesets', function() {
        this.rsets.ruleCache.set(example_host, 'value');
        assert(this.rsets.potentiallyApplicableRulesets(example_host), 'value');
      });

      it('returns applicable rule sets', function() {
        let target = ['value'];
        this.rsets.targets.set(example_host, target);

        let result = this.rsets.potentiallyApplicableRulesets(example_host),
          expected = new Set(target);
        assert.deepEqual(result, expected);
      });
    });
  });
})
