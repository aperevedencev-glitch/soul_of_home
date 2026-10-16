import React from 'react';
import {useCurrentFrame,useVideoConfig} from 'remotion';

const gold='#c7a36b';
export const Illustration:React.FC<{kind:string;progress:number}>=({kind,progress})=>{
 const frame=useCurrentFrame();const {fps}=useVideoConfig();
 const wave=(Math.sin(frame/fps*1.5)+1)/2;
 const raw=['base','center','lower','pattern','fabric','materials','tools','glue'].includes(kind);
 const decorated=['hero','decor','pearls','symmetry','check','dry','cap','ribbon','bow','contact','variants'].includes(kind);
 const fabric=['fabric','pattern','center','stretch','gather','tie','trim'].includes(kind);
 const cap=['hero','cap','ribbon','bow','contact','check','dry','variants'].includes(kind);
 const branches=Array.from({length:5},(_,i)=>i);
 return <svg viewBox="0 0 900 720" style={{width:'100%',height:'100%',overflow:'visible'}}>
 <defs>
 <radialGradient id="velvet" cx="32%" cy="26%" r="78%"><stop stopColor="#438b72"/><stop offset=".38" stopColor="#1b5c49"/><stop offset=".8" stopColor="#0c332c"/><stop offset="1" stopColor="#06231e"/></radialGradient>
 <radialGradient id="foam" cx="30%" cy="25%"><stop stopColor="#fffefa"/><stop offset=".7" stopColor="#e7dfcf"/><stop offset="1" stopColor="#bcb4a3"/></radialGradient>
 <radialGradient id="pearl" cx="28%" cy="23%"><stop stopColor="white"/><stop offset=".6" stopColor="#f4e4c9"/><stop offset="1" stopColor="#ab8c67"/></radialGradient>
 <linearGradient id="metal"><stop stopColor="#795929"/><stop offset=".35" stopColor="#f4dba2"/><stop offset=".65" stopColor="#b99559"/><stop offset="1" stopColor="#e4c88c"/></linearGradient>
 <pattern id="texture" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 0l2 3M4 3l1 3" stroke="#d3e5cd" strokeOpacity=".1" strokeWidth="1"/></pattern>
 <clipPath id="sphere"><circle cx="450" cy="360" r="205"/></clipPath>
 <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10" fill="none" stroke={gold} strokeWidth="2"/></marker>
 </defs>
 <ellipse cx="450" cy="625" rx="240" ry="25" fill="#153c30" opacity=".1"/>
 {fabric&&<><ellipse cx="450" cy="550" rx="340" ry="105" fill="#34745f" opacity=".88"/><ellipse cx="450" cy="550" rx="315" ry="83" fill="none" stroke="#b5c3a0" strokeDasharray="9 9" strokeOpacity=".5"/></>}
 {kind==='pattern'||kind==='fabric'?<>
 <ellipse cx="450" cy="352" rx="295" ry="200" fill="url(#velvet)"/><ellipse cx="450" cy="352" rx="295" ry="200" fill="url(#texture)"/>
 <ellipse cx="450" cy="352" rx="278" ry="185" fill="none" stroke={gold} strokeWidth="3" strokeDasharray="13 10" strokeDashoffset={-frame/fps*10}/>
 <path d="M180 620H720" stroke={gold} strokeWidth="3" markerStart="url(#arrow)" markerEnd="url(#arrow)"/>
 <text x="450" y="675" textAnchor="middle" fill="#476353" fontSize="32">{kind==='pattern'?'Диаметр круга: 26–28 см':'Отрез ткани: 30 × 30 см'}</text>
 <text x="450" y="360" textAnchor="middle" fill="#f6eddb" fontSize="32">Изнанка</text>
 </>:<>
 <g style={{translate:kind==='hero'?`0px ${Math.sin(frame/fps)*5}px`:'0px 0px'}}>
 <circle cx="450" cy="360" r="205" fill={raw?'url(#foam)':'url(#velvet)'}/>
 <circle cx="450" cy="360" r="205" fill="url(#texture)"/>
 {(kind==='lower'||kind==='upper')&&<g clipPath="url(#sphere)"><rect x="245" y={kind==='lower'?360:155} width="410" height="205" fill="#d4b16c" opacity={.25+wave*.2}/><path d="M245 360H655" stroke="#b18d51" strokeWidth="3" strokeDasharray="9 9"/>{Array.from({length:9},(_,i)=><path key={i} d={`M${260+i*45} ${kind==='lower'?370:170}v175`} stroke="#fff3c5" strokeWidth="12" opacity=".4" strokeDasharray="3 17"/>)}</g>}
 {['stretch','gather','tie','trim'].includes(kind)&&<>
 <path d={`M245 390Q190 ${490-wave*40} 235 550M655 390Q710 ${490-wave*40} 665 550`} stroke="#4b9175" strokeWidth="35" fill="none"/>
 <path d={`M212 ${490-wave*45}Q150 370 240 245M688 ${490-wave*45}Q750 370 660 245`} fill="none" stroke={gold} strokeWidth="5" markerEnd="url(#arrow)"/>
 {kind!=='stretch'&&<><path d="M390 170L416 90L440 154L455 84L475 157L496 100L510 172" fill="#34765a" stroke="#89a083" strokeWidth="2"/>
 <path d="M420 157Q450 173 485 157" stroke={kind==='gather'?'#497d60':gold} strokeWidth="8" fill="none"/></>}
 </>}
 {(decorated||kind==='mark'||kind==='stitch')&&<g clipPath="url(#sphere)">
 {branches.map((i)=>{const x=300+i*75;const appear=kind==='decor'?Math.min(1,progress*2-i*.1):1;return <g key={i} opacity={Math.max(0,appear)}>
 <path d={`M${x} 205Q${x+30} 340 ${x-10} 500M${x+9} 310l-38 -42M${x+13} 350l38 -40M${x+9} 402l-40 -35M${x} 450l38 -28`} fill="none" stroke={kind==='mark'?'#c8d5bc':gold} strokeWidth="3.5" strokeDashoffset={kind==='stitch'?Math.max(0,1-progress*2)*700:0} strokeDasharray={kind==='stitch'?700:kind==='mark'?'7 8':undefined}/>
 {decorated&&[[x-29,268],[x+51,310],[x-31,367],[x+38,422]].map(([px,py],j)=><circle key={j} cx={px} cy={py} r={j%2?9:12} fill="url(#pearl)" stroke="#d3ba90" strokeWidth="1"/>)}
 </g>})}
 </g>}
 {kind==='symmetry'&&<path d="M450 125V590" stroke="#ead7a1" strokeWidth="3" strokeDasharray="12 12"/>}
 {cap&&<g style={{translate:kind==='cap'?`0px ${-35*(1-Math.min(1,progress*4))}px`:'0px 0px'}}><path d="M408 165L414 130Q450 112 486 130L492 165Q450 180 408 165" fill="url(#metal)" stroke="#b18a4b" strokeWidth="2"/><ellipse cx="450" cy="113" rx="15" ry="24" fill="none" stroke="url(#metal)" strokeWidth="7"/></g>}
 {['hero','ribbon','bow','contact','variants'].includes(kind)&&<>
 <path d="M450 102C440 50 410 12 450 5C490 12 460 50 450 102" fill="none" stroke="#d5b276" strokeWidth="9"/>
 {kind!=='ribbon'&&<g fill="#c4a36d" stroke="#ecdbb7" strokeWidth="2"><path d="M450 115C355 30 337 90 372 128Q409 155 450 115C545 30 563 90 528 128Q491 155 450 115"/><path d="M443 119L407 203L432 190L446 204L457 123L486 203L500 184L523 191L464 118"/></g>}
 </>}
 </g>
 {kind==='base'&&<><path d="M245 620H655" stroke={gold} strokeWidth="3" markerStart="url(#arrow)" markerEnd="url(#arrow)"/><text x="450" y="680" textAnchor="middle" fontSize="38" fill="#476353">Ø 8 см</text></>}
 {kind==='trim'&&<><path d="M405 110H505" stroke={gold} strokeWidth="3" strokeDasharray="8 6"/><text x="565" y="115" fill="#476353" fontSize="30">5–7 мм</text></>}
 {kind==='dry'&&<g><circle cx="720" cy="530" r="60" fill="#f7efdd" stroke={gold} strokeWidth="3"/><path d={`M720 530L720 492M720 530L${720+Math.cos(frame/fps*.2)*35} ${530+Math.sin(frame/fps*.2)*35}`} stroke="#365d4c" strokeWidth="4"/></g>}
 {kind==='check'&&<path d="M675 320l35 35 65-80" fill="none" stroke="#43826a" strokeWidth="12" strokeLinecap="round"/>}
 </>}
 {['materials','glue','tools'].includes(kind)&&<g>
 <rect x="90" y="380" width="100" height="160" rx="15" fill="#f6ecda" stroke={gold} strokeWidth="3"/><rect x="115" y="350" width="50" height="35" rx="5" fill={gold}/><text x="140" y="470" textAnchor="middle" fontSize="21" fill="#365d4c">КЛЕЙ</text>
 <path d="M732 320L727 520" stroke="#b18755" strokeWidth="17"/><path d="M709 320L712 274H750L754 320Z" fill="#e5cb91"/>
 <g stroke={gold} strokeWidth="5" fill="none"><circle cx="710" cy="590" r="22"/><circle cx="766" cy="590" r="22"/><path d="M722 572L790 485M750 572L702 486"/></g>
 </g>}
 </svg>;
};

