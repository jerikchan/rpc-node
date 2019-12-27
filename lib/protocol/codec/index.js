const ByteBuffer = require('byte');
const v1 = require('./v1');

exports.responseEncode = (id, res, options) => {
  return exports.encode(id, res, options);
};

exports.encode = (cmd, options) => {
  return v1.encode(cmd, options);
};


const byteBuffer = new ByteBuffer({ size: 1 });

/**
 * 反序列化
 * @param {ByteBuffer} buf - 二进制
 * @param {Object}  options
 *   - {Map} reqs - 请求集合
 *   - {Object} [classCache] - 类定义缓存
 * @return {Object} 反序列化后的对象
 */
exports.decode = (buf, options) => {
  const start = Date.now();
  const bufLength = buf.length;
  byteBuffer._bytes = buf;
  byteBuffer._limit = bufLength;
  byteBuffer._size = bufLength;
  byteBuffer._offset = 0;
  const ret = v1.decode(byteBuffer, options);
  ret.meta = {
    size: bufLength,
    start,
    rt: Date.now() - start,
  };
  return ret;
};