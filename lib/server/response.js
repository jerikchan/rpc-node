'use strict';

class RpcResponse {
  constructor(req, connection) {
    this.req = req;
    this.connection = connection;
    this.meta = {
      start: Date.now(),
      rt: 0,
      data: null,
      responseEncodeRT: 0,
      serviceName: req.data.serverSignature,
      interfaceName: req.data.interfaceName,
      method: req.data.methodName,
      remoteIp: connection.remoteAddress,
      reqSize: req.meta && req.meta.size || 0,
      resSize: 0,
      resultCode: '00', // 00：成功，01：异常，03：超时，04：路由失败
    };
  }

  async send(res) {
    await this.connection.send(this.req, res);
  }
}

module.exports = RpcResponse;