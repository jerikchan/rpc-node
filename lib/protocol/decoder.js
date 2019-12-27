'use strict';

const codec = require('./codec');
const Writable = require('stream').Writable;

const packetLengthFns = {
  1(buf, bufLength) {
    const headerLength = 32;
    if (bufLength < headerLength) {
      return 0;
    }
    return headerLength + buf.readInt32BE(4);
  },
};

class ProtocolDecoder extends Writable {
  constructor(options = {}) {
    super(options);
    this._buf = null;
    this.options = options;
  }

  _write(chunk, encoding, callback) {
    // 合并 buf 中的数据
    this._buf = this._buf ? Buffer.concat([ this._buf, chunk ]) : chunk;
    try {
      let unfinish = false;
      do {
        unfinish = this._decode();
      } while (unfinish);
      callback();
    } catch (err) {
      err.name = 'BoltDecodeError';
      err.data = this._buf ? this._buf.toString('base64') : '';
      callback(err);
    }
  }

  _decode() {
    const version = this._buf[2]; // 协议版本号，如果head的格式有变化，例如扩展成40个字节，此时解包的地方就可以根据version来做兼容处理
    const bufLength = this._buf.length;
    const getPacketLength = packetLengthFns[version];
    if (!getPacketLength) {
      const err = new Error('[sofa-bolt-node] Unknown protocol type:' + version);
      throw err;
    }
    const packetLength = getPacketLength(this._buf, bufLength);
    if (packetLength === 0 || bufLength < packetLength) {
      return false;
    }
    const packet = this._buf.slice(0, packetLength);
    // 调用反序列化方法获取对象
    const obj = codec.decode(packet, this.options);
    this.emit(obj.packetType, obj);
    const restLen = bufLength - packetLength;
    if (restLen) {
      this._buf = this._buf.slice(packetLength);
      return true;
    }
    this._buf = null;
    return false;
  }

  _destroy() {
    this._buf = null;
    this.emit('close');
  }
}

module.exports = ProtocolDecoder;
