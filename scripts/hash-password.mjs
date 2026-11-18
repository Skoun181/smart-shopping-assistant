import { randomBytes, scryptSync } from 'node:crypto';
import readline from 'node:readline';

if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
  console.error('Bitte in einem interaktiven Terminal ausführen.');
  process.exit(1);
}
process.stdout.write('Gemeinsames Passwort (Eingabe unsichtbar, mindestens 12 Zeichen): ');
const chars = [];
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding('utf8');
process.stdin.on('data', (key) => {
  if (key === '\u0003') process.exit(130);
  if (key === '\r' || key === '\n') {
    process.stdin.setRawMode(false);
    process.stdin.pause();
    process.stdout.write('\n');
    const password = chars.join('');
    if (password.length < 12 || Buffer.byteLength(password) > 1024) {
      console.error('Passwort muss 12 bis 1024 Bytes lang sein.');
      process.exitCode = 1;
      return;
    }
    const salt = randomBytes(16);
    const digest = scryptSync(password, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
    console.log("APP_PASSWORD_HASH='scrypt$32768$8$1$" + salt.toString('base64') + ':' + digest.toString('base64') + "'");
    console.log('Den generierten Wert vollständig in die .env-Datei kopieren.');
  } else if (key === '\u007f') chars.pop();
  else if (key.length === 1) chars.push(key);
});
