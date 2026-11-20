// Minimal, bounded ZIP-store implementation. We accept only our two known files
// and never extract archive paths to disk. No compression or ZIP64 support.
const signature={local:0x04034b50,central:0x02014b50,end:0x06054b50};
export const MAX_ARCHIVE_BYTES=32*1024*1024;
const MAX_ENTRY_BYTES=24*1024*1024;
const table=Uint32Array.from({length:256},(_,i)=>{
  let c=i;for(let n=0;n<8;n++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;
});
export function crc32(bytes:Uint8Array):number{
  let crc=0xffffffff;
  for(const byte of bytes)crc=table[(crc^byte)&255]^(crc>>>8);
  return (crc^0xffffffff)>>>0;
}
function fail():never{throw new Error('Invalid or unsupported backup ZIP');}
export function makeZip(entries:Record<'manifest.json'|'data.json',Buffer>):Buffer{
  const locals:Buffer[]=[],centrals:Buffer[]=[];
  let position=0;
  for(const filename of ['manifest.json','data.json'] as const){
    const value=entries[filename],name=Buffer.from(filename,'utf8');
    if(value.length>MAX_ENTRY_BYTES)throw new Error('Backup exceeds file size limit');
    const checksum=crc32(value);
    const header=Buffer.alloc(30+name.length);
    header.writeUInt32LE(signature.local,0);
    header.writeUInt16LE(20,4);header.writeUInt16LE(0,6);header.writeUInt16LE(0,8);
    header.writeUInt32LE(checksum,14);
    header.writeUInt32LE(value.length,18);header.writeUInt32LE(value.length,22);
    header.writeUInt16LE(name.length,26);name.copy(header,30);
    locals.push(header,value);
    const central=Buffer.alloc(46+name.length);
    central.writeUInt32LE(signature.central,0);
    central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);
    central.writeUInt32LE(checksum,16);
    central.writeUInt32LE(value.length,20);central.writeUInt32LE(value.length,24);
    central.writeUInt16LE(name.length,28);
    central.writeUInt32LE(position,42);name.copy(central,46);
    centrals.push(central);position+=header.length+value.length;
  }
  const centralSize=centrals.reduce((n,b)=>n+b.length,0),end=Buffer.alloc(22);
  end.writeUInt32LE(signature.end,0);
  end.writeUInt16LE(2,8);end.writeUInt16LE(2,10);
  end.writeUInt32LE(centralSize,12);end.writeUInt32LE(position,16);
  const zip=Buffer.concat([...locals,...centrals,end]);
  if(zip.length>MAX_ARCHIVE_BYTES)throw new Error('Backup exceeds archive size limit');
  return zip;
}
export function readZip(bytes:Buffer):Record<'manifest.json'|'data.json',Buffer>{
  if(bytes.length<22||bytes.length>MAX_ARCHIVE_BYTES)fail();
  const end=bytes.length-22;
  if(bytes.readUInt32LE(end)!==signature.end||
     bytes.readUInt16LE(end+4)!==0||bytes.readUInt16LE(end+6)!==0||
     bytes.readUInt16LE(end+8)!==2||bytes.readUInt16LE(end+10)!==2||
     bytes.readUInt16LE(end+20)!==0)fail();
  const size=bytes.readUInt32LE(end+12),start=bytes.readUInt32LE(end+16);
  if(start+size!==end)fail();
  const files:Record<string,Buffer>={},ranges:Array<[number,number]>=[];
  let cursor=start;
  for(let i=0;i<2;i++){
    if(cursor+46>end||bytes.readUInt32LE(cursor)!==signature.central)fail();
    const flags=bytes.readUInt16LE(cursor+8),method=bytes.readUInt16LE(cursor+10);
    const checksum=bytes.readUInt32LE(cursor+16);
    const compressed=bytes.readUInt32LE(cursor+20),uncompressed=bytes.readUInt32LE(cursor+24);
    const nameLength=bytes.readUInt16LE(cursor+28),extraLength=bytes.readUInt16LE(cursor+30);
    const commentLength=bytes.readUInt16LE(cursor+32),disk=bytes.readUInt16LE(cursor+34);
    const localOffset=bytes.readUInt32LE(cursor+42);
    const next=cursor+46+nameLength+extraLength+commentLength;
    if(next>end||disk||flags||method||uncompressed!==compressed||uncompressed>MAX_ENTRY_BYTES)fail();
    const filename=bytes.subarray(cursor+46,cursor+46+nameLength).toString('utf8');
    if(!['manifest.json','data.json'].includes(filename)||files[filename])fail();
    if(localOffset+30+nameLength>start||bytes.readUInt32LE(localOffset)!==signature.local)fail();
    if(bytes.readUInt16LE(localOffset+6)!==0||bytes.readUInt16LE(localOffset+8)!==0||
       bytes.readUInt32LE(localOffset+14)!==checksum||
       bytes.readUInt32LE(localOffset+18)!==compressed||
       bytes.readUInt32LE(localOffset+22)!==uncompressed||
       bytes.readUInt16LE(localOffset+26)!==nameLength||
       bytes.readUInt16LE(localOffset+28)!==0||
       !bytes.subarray(localOffset+30,localOffset+30+nameLength).equals(Buffer.from(filename)))fail();
    const bodyStart=localOffset+30+nameLength,bodyEnd=bodyStart+compressed;
    if(bodyEnd>start||ranges.some(([from,to])=>localOffset<to&&bodyEnd>from))fail();
    const payload=bytes.subarray(bodyStart,bodyEnd);
    if(crc32(payload)!==checksum)fail();
    files[filename]=payload;ranges.push([localOffset,bodyEnd]);cursor=next;
  }
  if(cursor!==end||!files['manifest.json']||!files['data.json'])fail();
  return files as Record<'manifest.json'|'data.json',Buffer>;
}
