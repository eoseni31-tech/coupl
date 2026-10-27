import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
for(const folder of ['server','scripts','api','public','test'])for(const file of await readdir(folder))if(file.endsWith('.js')){const r=spawnSync(process.execPath,['--check',`${folder}/${file}`],{encoding:'utf8'});if(r.status){process.stderr.write(r.stderr);process.exit(1);}}
for(const file of ['package.json','vercel.json'])JSON.parse(await readFile(file,'utf8'));

console.log('Server and browser syntax, embedded invitation scripts, configuration and public credential checks passed. No frontend compilation is required.');
