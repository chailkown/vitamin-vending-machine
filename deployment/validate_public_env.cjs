const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const urls = [];
for (const [app, prefix] of [['frontend','REACT_APP'],['health-app-web','VITE']]) {
  const values = Object.fromEntries(fs.readFileSync(path.join(root,app,'.env'),'utf8').split(/\r?\n/)
    .filter(line=>/^\s*[A-Z][A-Z0-9_]*\s*=/.test(line)).map(line=>{
      const at=line.indexOf('='); return [line.slice(0,at).trim(),line.slice(at+1).trim().replace(/^(['"])(.*)\1$/,'$2')];
    }));
  const url=values[`${prefix}_SUPABASE_URL`];
  const key=values[`${prefix}_SUPABASE_ANON_KEY`];
  if (!url || !/^https:\/\/[^/]+\.supabase\.co\/?$/.test(url) || !key) throw Error(`${app}: missing/invalid public Supabase configuration`);
  if (key.startsWith('sb_secret_')) throw Error(`${app}: secret key must not be in browser configuration`);
  if (!key.startsWith('sb_publishable_')) {
    let payload;
    try { payload=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()); } catch { throw Error(`${app}: invalid public key format`); }
    if (payload.role !== 'anon') throw Error(`${app}: browser key must have the anon role`);
  }
  urls.push(url.replace(/\/$/,''));
  const overlays=fs.readdirSync(path.join(root,app)).filter(name=>/^\.env\./.test(name) && name!=='.env.example');
  if (overlays.length) throw Error(`${app}: review local environment overrides before building: ${overlays.join(', ')}`);
  console.log(`${app}: public URL/key checked (values hidden)`);
}
if (urls[0]!==urls[1]) throw Error('The two apps point to different Supabase projects');
