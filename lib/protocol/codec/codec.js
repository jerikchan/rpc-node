'use strict';

const Constants = require('./const');
const Errno = require('@fk/Errno');

const BODYLEN_OFFSET = 4;
const CHKSUM_OFFSET = 8;

class Codec {
  static encodeChksum(io, chksum) {
    io.putShort(CHKSUM_OFFSET, chksum);
  }

  static encodeBodylen(io, bodylen) {
    io.putInt(BODYLEN_OFFSET, bodylen);
  }

  static encode(io, options) {
    io.putShort(Constants.headers.MAGIC);
    io.put(Constants.headers.VERSION);
    io.put(Constants.headers.headExLen);
    // 预留 bodylen
    io.skip(4);
    // 预留 chksum
    io.skip(2);
    io.putShort(options.header.flag);
    io.putInt(options.header.flow);
    io.putInt(options.header.aid);
    io.putShort(options.header.cmd);
    io.putShort(Errno.OK);
    io.putShort(options.header.wid);
    io.putShort(Constants.headers.reserved1);
    io.putInt(Constants.headers.reserved2);
  }

  static decode(io) {
    const magic = io.getShort();
    const version = io.get();
    const headExLen = io.getInt8();
    const bodylen = io.getInt();
    const chksum = io.getShort();
    const flag = io.getShort();
    const flow = io.getInt();
    const aid = io.getInt();
    const cmd = io.getShort();
    const result = io.getShort();
    const wid = io.getShort();
    const reserved1 = io.getShort();
    const reserved2 = io.getInt();
    const headerEx = headExLen ? io.read(headExLen): null;
    const body = io.read(bodylen);

    return {
      header: {
        magic,
        version,
        headExLen,
        bodylen,
        chksum,
        flag,
        flow, 
        aid, 
        cmd, 
        result,
        wid, 
        reserved1,
        reserved2
      },
      headerEx,
      body
    }
  }
}

module.exports = Codec;