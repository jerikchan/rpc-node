'use strict';

const FaiBuffer = require('@fk/FaiBuffer');
const Errno = require('@fk/Errno');
const debug = require('debug')('protocol:codec:serializer');

class Serializer {
  static decodeHeaderEx(buf) {
    const valueRef = {};
    const recvHeaderEx = new FaiBuffer(buf);
    recvHeaderEx.decodeString(valueRef);
    return valueRef.value;
  }

  static encode(buf, res) {
    const sendBody = res.appResponse;
    const sendBuf = sendBody.buffer();
    const bytes = sendBuf.array();
    debug('bytes', bytes);
    debug('bytes.length', bytes.length);
    buf.put(bytes);
  }
  
  static decode(buf) {
    // 实例化 FaiBuffer
    const recvBody = new FaiBuffer(buf);

    let rt = Errno.ERROR;
    let bufKeyRef = {};

    // arg JSON格式的字符串类型
    const argRef = {};
    rt = recvBody.getString(bufKeyRef, argRef);
    if (rt != Errno.OK || bufKeyRef.value != 2) {
      rt = Errno.ARGS_ERROR;
      debug(rt, "arg=null;flow=%d;", flow);
      return rt;
    }

    return {
      data: {
        args: [ JSON.parse(argRef.value) ]
      }
    };
  }
}

module.exports = Serializer;