const fs=require('fs');
const path=require('path');
const raw=fs.readFileSync(path.join(__dirname,'src/lesson-data.ts'),'utf8');
const shots=Function('return '+raw.slice(raw.indexOf('= [')+2).trim().replace(/;$/,''))();
const target=process.argv[2]||__dirname;
const stamp=ms=>{ms=Math.round(ms);const h=Math.floor(ms/3600000),m=Math.floor(ms/60000)%60,s=Math.floor(ms/1000)%60;return [h,m,s].map(x=>String(x).padStart(2,'0')).join(':')+','+String(ms%1000).padStart(3,'0')};
const wrap=(str,max)=>{const rows=[];let row='';for(const word of str.split(/\s+/)){if(row&&(row+' '+word).length>max){rows.push(row);row=word}else row+=(row?' ':'')+word}if(row)rows.push(row);return rows};
let srt='',index=0,previousEnd=0;
for(const shot of shots){const lines=wrap(shot.text,42);const cues=[];for(let i=0;i<lines.length;i+=2)cues.push(lines.slice(i,i+2).join('\n'));cues.forEach((text,i)=>{const start=Math.round((shot.at+(shot.end-shot.at)*i/cues.length)*1000),end=Math.round((shot.at+(shot.end-shot.at)*(i+1)/cues.length)*1000);if(start<previousEnd||end<=start)throw Error('Invalid timing');srt+=`${++index}\n${stamp(start)} --> ${stamp(end)}\n${text}\n\n`;previousEnd=end})}
const txt='БАРХАТНЫЙ ШАР СВОИМИ РУКАМИ\nТекст текущей версии урока · 9 минут\n\n'+shots.map(s=>`${stamp(s.at*1000).slice(3,8)}–${stamp(s.end*1000).slice(3,8)} | ${s.chapter}\n${s.title}\n${s.text}${s.detail?'\nПодсказка: '+s.detail:''}\n`).join('\n');
fs.writeFileSync(path.join(target,'Бархатный шар — субтитры.srt'),'\ufeff'+srt,'utf8');
fs.writeFileSync(path.join(target,'Бархатный шар — текст урока.txt'),'\ufeff'+txt,'utf8');
console.log(`Saved ${index} subtitle cues; ${shots.length} text sections; duration ${previousEnd/1000}s`);
