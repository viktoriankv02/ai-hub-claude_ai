import {restoreBackup} from '../src/backup.mjs';
const [source,destination,...extra]=process.argv.slice(2);
if(!source||!destination||extra.length) {
  console.error('Використання: npm run backup:restore -- <копія.sqlite> <новий-файл.sqlite>');
  process.exitCode=1;
}else {
  try{console.log(JSON.stringify(await restoreBackup(source,destination),null,2));}
  catch(error){console.error(error.code==='EEXIST'?'Файл призначення вже існує. Вкажіть нове ім’я; перезапис не дозволено.':error.message);process.exitCode=1;}
}
