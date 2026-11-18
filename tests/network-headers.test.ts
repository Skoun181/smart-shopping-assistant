import {describe,expect,test} from 'vitest';
import {prepareHeaders} from '../scripts/network-headers.mjs';
describe('trusted network ingress',()=>{
  test('direct LAN ignores all forged forwarding headers',()=>{
    const h:Record<string,string>={host:'192.168.1.50:3000','x-forwarded-proto':'https','x-forwarded-host':'evil.example','x-real-ip':'1.2.3.4','x-ssa-protocol':'https','x-ssa-client-ip':'8.8.8.8'};
    expect(prepareHeaders(h,'192.168.1.2',false)).toBe(true);
    expect(h).toEqual({host:'192.168.1.50:3000','x-ssa-protocol':'http','x-ssa-client-ip':'192.168.1.2'});
  });
  test('direct host rejects external domain and malformed authorities',()=>{
    for(const host of ['evil.example','192.168.1.50@evil.example','localhost/path','localhost:99999','localhost,evil.example'])
      expect(prepareHeaders({host},'127.0.0.1',false)).toBe(false);
  });
  test('trusted proxy accepts canonical host and protocol; internal headers are replaced',()=>{
    const h:Record<string,string>={host:'shopping.home.arpa:8443','x-forwarded-proto':'https','x-real-ip':'192.168.1.2','x-ssa-protocol':'http'};
    expect(prepareHeaders(h,'127.0.0.1',true)).toBe(true);
    expect(h).toEqual({host:'shopping.home.arpa:8443','x-ssa-protocol':'https','x-ssa-client-ip':'192.168.1.2'});
  });
  test('proxy requires a single valid protocol',()=>{
    for(const proto of [undefined,'https,http','ftp','https:'])expect(prepareHeaders({host:'shopping.home.arpa','x-forwarded-proto':proto},'127.0.0.1',true)).toBe(false);
  });
});
