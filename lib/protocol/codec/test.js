const ByteBuffer = require('byte');

const toShort = (sum) => {
  console.log('toShort------', sum);
  sum = (sum << 16) >> 16;
  console.log('toShort end------', sum);
  return sum;
};

const genChksum = (buf, checkLen) => {
  let sum = 0;
  const len = checkLen / 2;
  const mod = checkLen % 2;

  // Our algorithm is simple, using a 32 bit accumulator (sum), we add
  // sequential 16 bit words to it, and at the end, fold back all the
  // carry bits from the top 16 bits into the lower 16 bits.
  for (let i = 0; i < len; i++) {
    sum += buf.readInt8(i);
  }

  // 4mop up an odd byte, if necessary
  if (mod === 1) {
    const b = buf.readInt8(checkLen - 1);
    sum += b;
  }

  // 4add back carry outs from top 16 bits to low 16 bits
  // add hi 16 to low 16
  sum = (sum >>> 16) + (sum & 0xffff);

  // add carry
  sum += (sum >>> 16);
  
  // truncate to 16 bits
  return toShort(~(toShort(sum)));
};

const byteBuffer = ByteBuffer.allocate(32);
const byteList = 
[0x11, 0x22, 0x01, 0x00, 0x00, 0x00, 0x05, 0x61, 0x00, 0x00, 0x00, 0x00, 0x00, 0x99, 0x3e, 0x78,
   0x00, 0x96, 0x4d, 0x5e, 0x00, 0x0b, 0x00, 0x00, 0x02, 0x58, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
byteList.forEach(byte => byteBuffer.put(byte));
const bytes = byteBuffer.get(0, 32);
console.log(bytes);
const chksum = genChksum(bytes, 32);
console.log(chksum);
const _buf = Buffer.alloc(2);
_buf.writeInt16BE(chksum);
console.log(_buf);