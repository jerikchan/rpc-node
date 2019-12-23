'use strict';

const Base = require('sdk-base');

const defaultOptions = {};

// 定时心动信号标志
const HEARTBEAT_REQ = 'nodehelo';
const HEARTBEAT_RES = 'ok';

// 参考 java CoreCenter flow 实现
const FLOW_INIT = 1000; 

// Integer.MAX_VALUE 2147483647 预留后三位
const FLOW_MAX = 2147483; 

// 防粘包前后标志 和 ssr.jsp.inc 需要保持一致
const PACKET_STARTS_WITH = '-!@@!-';
const PACKET_ENDS_WITH = '-@!!@-';

class RpcConnection extends Base {
  /**
   * 服务提供者抽象
   * 
   * @param {Object} options
   *   - {Socket} socket - tcp socket 示例
   *   - {Logger} logger - 日志对象
   */
  constructor(options = {}) {
    assert(options.socket, '[RpcConnection] options.socket is required');
    assert(options.logger, '[RpcConnection] options.logger is required');
    super(Object.assign({}, defaultOptions, options));

    this._data = '';
    this._flow = FLOW_INIT;
    this._endIndex = 0;
    this._startIndex = 0;

    this.socket.on('data', buffer => { this._handleSocketData(buffer.toString()); });
  }

  async send(req, res) {
    this.socket.write(res);
    this.socket.end();
  }

  _handleSocketData(data) {
    const isHealthyCode = this._handleHeartbeat(data);
    if (isHealthyCode) {
      return;
    }
    this._handleFlow();
    this._data += data;
    const isFullData = this._handlePacketSplicing();
    if (isFullData) {
      const isHealthyCode = this._handleHeartbeat(this._data);
      if (isHealthyCode) {
        return;
      }

      this.emit('request', {
        data: this._data
      });

      // 重置 data 缓存
      this._data = this._data.substring(this._endIndex + PACKET_ENDS_WITH.length);
    }
  }
  
  /**
   * 避免粘包处理，只获取 PACKET_STARTS_WITH 和 PACKET_ENDS_WITH 之间的数据
   */
  _handlePacketSplicing() {
    this._endIndex = this._data.indexOf(PACKET_ENDS_WITH);
    const isFullData = this._endIndex > -1;
    if (isFullData) {
      this._startIndex = (this._startIndex = this._data.indexOf(PACKET_STARTS_WITH)) > -1 ? this._startIndex : 0;
      this._data = this._data.substring(this._startIndex + PACKET_STARTS_WITH.length, this._endIndex);
    }
    return isFullData;
  }

  /**
   * 流水号后三位用来记录 IP，方便后端 svr 查询请求的 resin 的 ip
   */
  _handleFlow() {
    this._flow++;
    if (this._flow > FLOW_MAX) {
      this._flow = FLOW_INIT;
    } 
  }

  /**
   * 监控脚本-定时心动信号，检测到 data == nodehelo 的话返回 ok，如果没有返回的话 nginx 那边就会重启改 server
   * 
   * @param {String} data socket data
   */
  _handleHeartbeat(data) {
    const isHealthyCode = data === HEARTBEAT_REQ;
    if (isHealthyCode) {
      this.socket.write(HEARTBEAT_RES);
    }
    return isHealthyCode;
  }

  get socket() {
    return this.options.socket;
  }
}

module.exports = RpcConnection;