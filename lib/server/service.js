'use strict';

const is = require('is-type-of');
const Base = require('sdk-base');

class RpcService extends Base {
  constructor(options = {}) {
    super(options);

    this.delegate = options.delegate;

    this.ready(true);
  }

  async invoke(ctx, req, res) {
    const args = req.data;
    const methodName = 'invoke';
    const method = this.delegate[methodName];
    const data = {
      isError: false,
      errorMsg: null,
      appResponse: null
    };

    if (!is.asyncFunction(method)) {
      data.isError = true;
      data.errorMsg = 'Can not find method';
    } else {
      let result;
      try {
        result = await method.apply(ctx, args);
      } catch (err) {
        data.isError = true;
        data.errorMsg = err.message;

        result = err;
      }
      data.appResponse = result;
    }

    await res.send(data);
  }
}

module.exports = RpcService;

