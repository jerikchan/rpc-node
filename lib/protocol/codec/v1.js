'use strict';

const sharedByteBuffer = require('../shared_byte_buffer');
const debug = require('debug')('protocol:codec:v1');
const Constants = require('./const');
const genChksum = require('@fk/genChksum');
const Serializer = require('./serializer');
const Codec = require('./codec');

/**
 * protocol for v1
 * 0           2     3     4                       8          10            12                     16
 * +-----+-----+-----+-----+-----+-----+-----+-----+-----+-----+-----+------+-----+-----+-----+-----+
 * |   magic   |versi|heade|        bodylen        |   chksum  |    flag    |          flow         |
 * +-----------+-----------+-----------+-----------+-----------+------------+-----------+-----------+
 * |          aid          |    cmd    |   result  |    wid    |  reserved1 |       reserved2       |
 * +-----------+-----------+-----------+-----------+-----------+------------+-----------+-----------+
 * |                                     content bytes                                              |
 * +                                                                                                +
 * |                                         ... ...                                                |
 * +------------------------------------------------------------------------------------------------+
 *
 * magic: 一个特别的数字，用于解包时校验是否合法包
 * version: 协议版本号，如果head的格式有变化，例如扩展成40个字节，此时解包的地方就可以根据version来做兼容处理
 * headexlen: 包头扩展的长度，如果有特殊协议需要在原包头和包体之间扩展填充一些数据，可以使用。
 * bodylen: 包体长度
 * chksum: 对head中除chksum外的数据计算校验值，解包时校对该值是否一致，如果不一致则数据传输过程中有损坏
 * flag: 特殊标志，例如当前是否需要keep-alive，是否send-only（无需回包）
 * flow: 流水号，例如一个页面请求时，会生成一个flow，然后这个请求过程中，所有的数据包都带有该flow，这样再调试问题时会非常方便
 * aid: 用户aid
 * cmd: 协议命令号
 * result: 处理结果
 * wid: 用户wid，目前用于建站产品的多网站和多语言方案，不同的wid表示不同的网站和不同的语言版本 ，wid是siteId和Lgid的组合数据，定义参考SiteDef
 * reserved1: 保留字段
 * reserved2: 保留字段
 *
 */
exports.encode = (res, options) => {
  sharedByteBuffer.clear();
  
  // 协议头编码
  Codec.encode(sharedByteBuffer, options);

  // 计算内容长度
  const start = sharedByteBuffer.position();
  Serializer.encode(sharedByteBuffer, res);
  Codec.encodeBodylen(sharedByteBuffer, sharedByteBuffer.position() - start);

  // 计算查错校验码
  const chksum = genChksum(sharedByteBuffer.get(0, Constants.HEADER_LEN), Constants.HEADER_LEN);
  Codec.encodeChksum(sharedByteBuffer, chksum);

  const buf = sharedByteBuffer.array();
  debug('send buf length = %s', buf.length);
  return buf;
};

exports.decode = (io, options = {}) => {
  // 协议头解码
  const { header, headerEx, body } = Codec.decode(io);
  debug('#decode:header', header);
  debug('#decode:headerEx', headerEx);

  // 查错校验
  if (header.chksum) {
    const frame = io._bytes.slice(0, Constants.HEADER_LEN);
    debug('#decode:frame::origin', frame);
    frame.writeInt16BE(0, 8);
    debug('#decode:frame::reset', frame);
    if (genChksum(frame, Constants.HEADER_LEN) !== header.chksum) {
      throw new Error('chksum check failed!');
    }
  }

  // 扩展协议头反序列化
  const serverSignature = Serializer.decodeHeaderEx(headerEx);
  debug('#decode:serverSignature', serverSignature);

  // 内容反序列化
  debug('#decode:body.length', body.length);

  return {
    packetType: 'request',
    options: {
      header
    },
    data: {
      serverSignature: serverSignature,
      methodName: header.cmd,
      args: [ body ]
    },
    meta: null
  };
};
