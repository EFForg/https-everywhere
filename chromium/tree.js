// split a hostname and reverse it
function splitter(dottedName) {
  return dottedName.split('.').reverse();
}

let Node = Map;

function Tree() {
  this._base = new Node();
}

/**
 * Prefix tree with same API as Map
 */
Tree.prototype = {
  _prep: function(item, callback) {
    let parts = splitter(item),
      len = parts.length,
      node = this._base;
    return callback(parts, len, node);
  },

  setNode: function(item, callback) {
    this._prep(item, (parts, len, node) => {
      for (let i = 0; i < len; i++) {
        let part = parts[i];
        if (!node.has(part)) {
          node.set(part, new Node());
        }
        node = node.get(part);
      }
      return callback(node);
    });
  },

  getNode: function(item, callback) {
    this._prep(item, (parts, len, node) => {
      for (let i = 0; i < len; i++) {
        let part = parts[i];
        if (!node.has(part)) {
          return callback(undefined);
        }
        node = node.get(part);
      }
      return callback(node);
    });
  },

  set: function(item, val) {
    return this.setNode(item, val, node => node.data = val);
  },

  get: function(item) {
    return this.getNode(item, node => (typeof node == 'undefined') ? node : node.data);
  },

  has: function(item) {
    if (typeof this.get(item) == 'undefined') {
      return false;
    }
    return true;
  },

  delete: function(item) {
    this._prep(item, (parts, len, node) => {
      let branch = [node];

      // crawl to end of branch
      for (let i = 0; i < len; i++) {
        let part = parts[i];
        if (!node.has(part)) {
          return false;
        }
        node = node.get(part);
        branch.push(node);
      }

      // delete if present
      if (!node.hasOwnProperty('data')) {
        return false;
      }
      delete node.data;

      // crawl back, deleting nodes with no children/data;
      for (let i = branch.length - 1; i > 0; i--) {
        if (branch[i].hasOwnProperty('data') || branch[i].size > 0) {
          break;
        }
        branch[i].delete(parts[i]);
      }
      return true;
    });
  },
};
