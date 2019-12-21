'use strict';

const net = require('net');
const assert = require('assert');
const Base = require('sdk-base');
const RpcConnection = require('./connection');

const defaultOptions = {
  port: 12200,
  connectionClass: RpcConnection
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

    this.publishPort = this.options.port;
    this.connectionClass = this.options.connectionClass;
  }

  get listenPorts() {
    return [ this.publishPort ];
  }

  get logger() {
    return this.options.logger;
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
    conn.on('request', () => {})
    this.emit('connection', conn);
  }
};

module.exports = RpcServer;