'use strict';

const byteBuffer = require('../shared_byte_buffer');

const genChksum = (buf, checkLen) => {
  let sum = 0;
  const len = checkLen / 2;
  const mod = checkLen % 2;

  // Our algorithm is simple, using a 32 bit accumulator (sum), we add
  // sequential 16 bit words to it, and at the end, fold back all the
  // carry bits from the top 16 bits into the lower 16 bits.
  for (let i = 0; i < len; i++) {
    sum += buf[i];
  }

  // 4mop up an odd byte, if necessary
  if (mod === 1) {
    const b = buf[checkLen - 1];
    sum += b;
  }

  // 4add back carry outs from top 16 bits to low 16 bits
  // add hi 16 to low 16
  sum = (sum >>> 16) + (sum & 0xffff);

  // add carry
  sum += (sum >>> 16);

  return ((~(((sum << 16) >> 16))) << 16) >> 16;
};

/**
 * protocol for v1
 * 0           2     3     4                       8          10            12                     16
 * +-----+-----+-----+-----+-----+-----+-----+-----+-----+-----+-----+------+-----+-----+-----+-----+
 * |   magic   |versi|heade|        bodylen        |   chksum  |    flag    |          flow         |
 * +-----------+-----------+-----------+-----------+-----------+------------+-----------+-----------+
 * |          aid          |    cmd    |   result  |    wid    |  reserved1 |       reserved2       |
 * +-----------+-----------+-----------+-----------+-----------+------------+-----------+-----------+
 * |                                     content  bytes                                             |
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
exports.encode = (id, res, options) => {
  byteBuffer.reset();
  
  byteBuffer.putShort(0x1122);
  byteBuffer.put(1);
  byteBuffer.put(0);

  const offset = byteBuffer.position();
  byteBuffer.skip(4);

  byteBuffer.putShort(0);

  byteBuffer.putShort(0);
  byteBuffer.putInt(88888);
  byteBuffer.putInt(99999);
  byteBuffer.putShort(1);
  byteBuffer.putShort(0);
  byteBuffer.putShort(600);
  byteBuffer.putShort(0);
  byteBuffer.putInt(0);

  const start = byteBuffer.position();
  byteBuffer.putRawString(res.appResponse);
  byteBuffer.putInt(offset, byteBuffer.position() - start);

  const chksum = genChksum(byteBuffer.array(0, 32), 32);
  byteBuffer.putShort(offset + 4, chksum);
  console.log(chksum);
  console.log(byteBuffer.array().readInt16BE(8));


  return byteBuffer.array();
};

exports.decode = (io, options = {}) => {
  const bodylen = io.getInt(4);
  const flow = io.getInt(12);
  const aid = io.getInt(16);
  const cmd = io.getShort(20);
  const wid = io.getShort(24);
  io.position(32);
  io.getRawString(bodylen)
  let body = JSON.parse(io.readRawString(bodylen));

  const ret = {
    packetType: 'request',
    options: {
      flow, 
      aid, 
      cmd, 
      wid, 
    },
    data: body,
    meta: null
  };
  
  return ret;
};
