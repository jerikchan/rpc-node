'use strict';

const Base = require('sdk-base');
const assert = require('assert');

class RpcService extends Base {
  constructor(options = {}) {
    assert(options.interfaceName, '[RpcService] options.interfaceName is required');
    super(options);

    this.version = options.version;
    
    this.id = this.interfaceName + ':' + this.version;
  }
}

module.exports = RpcService;

