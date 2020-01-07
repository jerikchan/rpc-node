'use strict';

const FaiBuffer = require('./FaiBuffer');
const Errno = require('./Errno');
const debug = require('debug')('protocol:codec:rpc_cmd');

// 以内存空间换 CPU 执行时间
const clazzBufMap = new Map();

class RpcCommand {
  constructor(obj, options = {}) {
    this.obj = obj;
    this.options = options;
    this.oneway = !!(obj && obj.oneway);
  }

  get className() {
    throw new Error('not implement');
  }

  get proto() {
    return this.options.proto;
  }

  get codecType() {
    return this.options.codecType;
  }

  get timeout() {
    return this.obj.timeout;
  }

  get classMap() {
    // 优先用 obj.classMap
    if (this.obj && this.obj.classMap) {
      return this.obj.classMap;
    }
    return this.options.classMap;
  }

  serializeClazz(byteBuffer) {
    if (!clazzBufMap.has(this.className)) {
      const buf = Buffer.from(this.className);
      clazzBufMap.set(this.className, buf);
      byteBuffer.put(buf);
    } else {
      byteBuffer.put(clazzBufMap.get(this.className));
    }
  }

  static serializeContent(byteBuffer, res) {
    byteBuffer.putRawString(res.appResponse);
  }

  static decode(bytes, ctx) {
    // 实例化 FaiBuffer
    const recvBody = new FaiBuffer(bytes);

    let rt = Errno.ERROR;
    let bufKeyRef = {};

    // serverSignature
    const serverSignatureRef = {};
    rt = recvBody.getString(bufKeyRef, serverSignatureRef);
    debug('bufKeyRef.value = %s', bufKeyRef.value);
    debug('serverSignatureRef.value = %s', serverSignatureRef.value);
    if (rt != Errno.OK || bufKeyRef.value != 0) {
      rt = Errno.ARGS_ERROR;
      debug(rt, "serverSignature=null;flow=%d;", flow);
      return rt;
    }

    // methodName
    const methodNameRef = {};
    rt = recvBody.getString(bufKeyRef, methodNameRef);
    debug('bufKeyRef.value = %s', bufKeyRef.value);
    debug('methodNameRef.value = %s', methodNameRef.value);
    if (rt != Errno.OK || bufKeyRef.value != 1) {
      rt = Errno.ARGS_ERROR;
      debug(rt, "methodName=null;flow=%d;", flow);
      return rt;
    }

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
        serverSignature: serverSignatureRef.value,
        methodName: methodNameRef.value,
        args: [ JSON.parse(argRef.value) ]
      }
    };
  }
}

module.exports = RpcCommand;