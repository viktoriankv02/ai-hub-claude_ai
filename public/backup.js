export function setupBackup(getToken) {
  const button=document.querySelector('#download-backup');const status=document.querySelector('#backup-status');
  button.onclick=async()=>{
    button.disabled=true;status.textContent='Готую цілісну копію бази…';
    try {
      const response=await fetch('/api/backup',{method:'POST',headers:{'Content-Type':'application/json','X-Session-Token':getToken()},body:'{}'});
      if(!response.ok){const result=await response.json();throw new Error(result.error);}
      const file=await response.blob();const url=URL.createObjectURL(file);
      const name=response.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1]||'drop-hunter-backup.sqlite';
      const link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),30000);
      status.textContent='Копію передано браузеру для завантаження. Збережіть файл у надійному місці.';
    }catch(error){status.textContent=error.message;}
    finally{button.disabled=false;}
  };
}
