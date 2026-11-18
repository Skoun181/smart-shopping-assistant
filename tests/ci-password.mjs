import { randomBytes, scryptSync } from 'node:crypto';
const salt=randomBytes(16);
const digest=scryptSync('ci-testing-password-very-long',salt,32,{N:32768,r:8,p:1,maxmem:64*1024*1024});
process.stdout.write('scrypt$32768$8$1$'+salt.toString('base64')+':'+digest.toString('base64'));
