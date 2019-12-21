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

    this._started = false;
    this._servers = [];
    this._services = new Map();

    this.publishPort = this.options.port;
    this.connectionClass = this.options.connectionClass;
    this.serviceClass = this.options.serviceClass;
  }

  get listenPorts() {
    return [ this.publishPort ];
  }

  get logger() {
    return this.options.logger;
  }

  /**
   * Add a service.
   * 
   * @param {Object} info The infomation
   * @param {Object} delegate The delegate
   * @return {void}
   */
  addService(info, delegate) {
    if (typeof info === 'string') {
      info = { interfaceName: info };
    }
    const service = new this.serviceClass(Object.assign({
      logger: this.logger,
      version: this.options.version,
      delegate
    }, info));
    service.on('error', err => { this.emit('error', err); });
    if (this._services.has(service.id)) {
      this.logger.warn('[RpcServer] service: %s already added, will override it', service.id);
    }
    this._services.set(service.id, service);
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
    if (!this._started) {
      this._started = true;
      for (const port of this.listenPorts) {
        const server = this._startServer(port);
        this._servers.push(server);
      }
      
      Promise.all(this._servers.map(server => awaitFirst(server, [ 'listening', 'error' ])))
        .then(() => {
          this.emit('listening');
          this.ready(true);
        }, err => {
          this.ready(err);
        });
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
        err.req = req;
        this.emit('error', err);
      })
    });
    this.emit('connection', conn);
  }

  createContext() {
    return null;
  }

  async _handleRequest(req, conn) {
    const id = req.data.serverSignature;
    req.data.interfaceName = req.data.interfaceName || req.data.serverSignature.split(':')[0];
    const service = this._services.get(id);
    const res = new this.responseClass(req, conn);
    const ctx = this.createContext(req, res);
    this.emit('request', { req });
    try {
      if (!service) {
        throw new Error('not found service: ' + id);
      }
      await service.invoke(ctx, req, res);
    } catch (e) {
      this.emit('error', e);
    } finally {
      this.emit('response', { ctx, req, res });
    }
  }
}

module.exports = RpcServer;