export function setupMaterialImport({mutate}) {
 const section=document.createElement('section');section.id='material-import';
 section.innerHTML='<h2>Імпорт CryptoRank</h2><p class="muted">Встав текст відкритої інструкції. Посилання й версія матеріалу збережуться для ШІ-аналізу. Сам сайт тут не завантажується.</p><form class="panel form-grid"><label>Назва для імпорту<input name="name" required maxlength="120"></label><label>Посилання CryptoRank<input name="source" type="url" required maxlength="2000" placeholder="https://cryptorank.io/…"></label><label class="wide">Текст інструкції<textarea name="text" required maxlength="16000" rows="8"></textarea></label><button type="submit">Імпортувати матеріал</button><p role="status"></p></form>';
 document.querySelector('#add').before(section);
 const form=section.querySelector('form'),status=form.querySelector('[role=status]'),button=form.querySelector('button');
 form.onsubmit=async e=>{e.preventDefault();button.disabled=true;try{await mutate('/api/materials/import',Object.fromEntries(new FormData(form)));status.textContent='Матеріал збережено. У картці проєкту натисни «Аналіз локальним ШІ».';form.reset();}catch(e){status.textContent=e.message;}finally{button.disabled=false;}};
}
