import {describe,expect,test} from 'vitest';
import {prepareHeaders} from '../scripts/network-headers.mjs';
describe('single port network ingress',()=>{
  test('direct IP defaults to HTTP and ignores spoofed client addresses',()=>{
    const h:Record<string,string>={host:'192.168.0.150:3000','x-real-ip':'1.2.3.4','x-forwarded-for':'8.8.8.8','x-ssa-protocol':'https'};
    expect(prepareHeaders(h,'192.168.0.10')).toBe(true);
    expect(h).toEqual({host:'192.168.0.150:3000','x-ssa-protocol':'http','x-ssa-client-ip':'192.168.0.10'});
  });
  test('local domain works without special configuration',()=>{
    const h:Record<string,string>={host:'list.xc.local'};
    expect(prepareHeaders(h,'192.168.0.66')).toBe(true);
    expect(h['x-ssa-protocol']).toBe('http');
  });
  test('HTTPS proxy preserves external host and scheme',()=>{
    const h:Record<string,string>={host:'list.xc.local:8443','x-forwarded-proto':'https','x-forwarded-host':'other.example'};
    expect(prepareHeaders(h,'192.168.0.66')).toBe(true);
    expect(h).toEqual({host:'list.xc.local:8443','x-ssa-protocol':'https','x-ssa-client-ip':'192.168.0.66'});
  });
  test('invalid host or protocol rejected',()=>{
    for(const host of ['localhost/path','localhost:99999','localhost,evil.example','localhost@evil.example'])
      expect(prepareHeaders({host},'127.0.0.1')).toBe(false);
    for(const proto of ['https,http','ftp','https:'])
      expect(prepareHeaders({host:'list.xc.local','x-forwarded-proto':proto},'127.0.0.1')).toBe(false);
  });
});
