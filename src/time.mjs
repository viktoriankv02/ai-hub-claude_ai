export function timestamp(value) {
  if(value===null||value==='')return null;
  if(typeof value!=='string')throw new Error('Дедлайн має містити дату, час і часовий пояс');
  const match=value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/);
  if(!match||!Number.isFinite(Date.parse(value)))throw new Error('Дедлайн має містити дату, час і часовий пояс');
  const [,year,month,day,hour,minute,second,zone]=match;
  const y=Number(year),m=Number(month),d=Number(day);
  if(y<2000||y>2100||m<1||m>12||d<1||d>new Date(Date.UTC(y,m,0)).getUTCDate()||Number(hour)>23||Number(minute)>59||Number(second)>59)throw new Error('Некоректна календарна дата');
  if(zone!=='Z'&&(Number(zone.slice(1,3))>14||Number(zone.slice(4))>59||(Number(zone.slice(1,3))===14&&Number(zone.slice(4))!==0)))throw new Error('Некоректний часовий пояс');
  return new Date(value).toISOString();
}
