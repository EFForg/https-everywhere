'use strict'

const expect = require('chai').expect,
  tu = require('./testing_utils'),
  incognito = require('../incognito');

describe('incognito.js', function() {
  beforeEach(function() {
    tu.stubber([
      ['chrome.windows.onCreated.addListener', tu.Mock()],
      ['chrome.windows.onRemoved.addListener', tu.Mock()],
      ['chrome.windows.getAll', tu.Mock()],
    ]);
  });

  describe('onIncognitoDestruction', function() {
    beforeEach(function() {
      incognito.state.incognito_session_exists = false;
      this.callbackCalled = false;
      this.callback = () => this.callbackCalled = true;
      this.instance = incognito.onIncognitoDestruction(this.callback);
    })

    it('no incognito session by default', function() {
      expect(incognito.state.incognito_session_exists).to.be.false;
    })

    it('with no incognito, callback not called', async function() {
      incognito.state.incognito_session_exists = false;

      await this.instance.detect_incognito_destruction();

      expect(this.callbackCalled).to.be.false;
    });

    it('with incognitos still open, callback not called', async function() {
      incognito.state.incognito_session_exists = true;
      chrome.windows.getAll = func => func([{incognito: true}]);

      await this.instance.detect_incognito_destruction();

      expect(this.callbackCalled, 'not called').to.be.false;
    });

    it('callback called when last incognito closed', async function() {
      incognito.state.incognito_session_exists = true;
      chrome.windows.getAll = func => func([]);

      await this.instance.detect_incognito_destruction();
      expect(incognito.state.incognito_session_exists, 'constant changed').to.be.false;
      expect(this.callbackCalled).to.be.true;
    });

    it('detects when an incognito window is created', function() {
      this.instance.detect_incognito_creation({incognito: true});
      expect(incognito.state.incognito_session_exists, 'constant changed').to.be.true;
    })
  });
});
