'use strict';

const net = require('net');
const assert = require('assert');
const Base = require('sdk-base');
const RpcConnection = require('./connection');
const RpcService = require('./service');
const RpcResponse = require('./response');

const defaultOptions = {
  port: 12200,
  connectionClass: RpcConnection,
  serviceClass: RpcService,
  responseClass: RpcResponse,
  version: '1.0'
};

class RpcServer extends Base {
  /**
   * Rpc 服务提供方
   * 
   * @param {Object} options 
   *   - {Logger} logger 日志对象 
   *   - {Number} [port=12200] 端口号
   */
  constructor(options) {
    assert(options.logger, '[RpcServer] options.logger is required');
    super(Object.assign({}, defaultOptions, options));

    this._servers = [];
    this._service = null;

    this.publishPort = this.options.port;
    this.connectionClass = this.options.connectionClass;
    this.serviceClass = this.options.serviceClass;
    this.responseClass = this.options.responseClass;
  }

  get logger() {
    return this.options.logger;
  }

  get listenPorts() {
    return [ this.publishPort ];
  }

  /**
   * Add a service.
   * 
   * @param {Object} delegate The delegate
   * @return {void}
   */
  addService(delegate) {
    const service = new this.serviceClass(Object.assign({
      logger: this.logger,
      version: this.options.version,
      delegate
    }));
    service.on('error', err => { this.emit('error', err); });

    this._service = service;
  }

  _startServer(port) {
    const server = net.createServer();
    server.on('error', err => { this.emit('error', err) });
    server.on('connection', socket => { this._handleSocket(socket); });
    server.listen(port, () => {
      this.logger.info('[RpcServer] server start on %s', port);
    });
    return server;
  }

  /**
   * Start the rpc server
   * 
   * @return {Promise} promise
   */
  start() {
    for (const port of this.listenPorts) {
      const server = this._startServer(port);
      this._servers.push(server);
    }

    return this.ready();
  }

  _handleSocket(socket) {
    const options = {
      socket,
      logger: this.logger
    };
    const conn = new this.connectionClass(options);
    conn.on('request', req => {
      this._handleRequest(req, conn).catch(err => {
        this.emit('error', err);
      });
    });
  }

  async _handleRequest(req, conn) {
    const service = this._service;
    const res = new this.responseClass(req, conn);
    const ctx = null;
    try {
      if (!service) {
        throw new Error('not found service');
      }
      await service.invoke(ctx, req, res);
    } catch (e) {
      this.emit('error', e);
    }
  }
}

module.exports = RpcServer;