import React from 'react';
import {AbsoluteFill,Composition,Img,staticFile,Interactive,Track,interpolate,useCurrentFrame,useVideoConfig} from 'remotion';
import {shots} from './lesson-data';

const SceneInner:React.FC<{start:number;end:number}>=({start})=>{
 const frame=useCurrentFrame(); const {fps}=useVideoConfig();
 const seconds=start+frame/fps;
 const shot=shots.find(s=>seconds>=s.at&&seconds<s.end)??shots[shots.length-1];
 const step=seconds<30?1:seconds<90?1:seconds<120?2:seconds<165?3:seconds<210?4:seconds<270?5:seconds<360?6:seconds<405?7:seconds<450?8:seconds>=510&&seconds<530?1:9;
 const local=(seconds-shot.at)*fps;
 const opacity=interpolate(local,[0,12],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
 const hero=['hero','contact','variants'].includes(shot.kind);
 return <AbsoluteFill style={{background:'#f5f0e5',color:'#193d32',fontFamily:'"Segoe UI", Arial, sans-serif'}}>
 <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse at 75% 40%,#e3e8d9 0%,transparent 60%)'}}/>
 <div style={{position:'absolute',left:90,top:65,fontSize:23,letterSpacing:6,fontWeight:600}}>SOUL HOME <span style={{color:'#a78a57',marginLeft:22,fontWeight:400}}>ШКОЛА РУЧНОЙ РАБОТЫ</span></div>
 <div style={{position:'absolute',right:90,top:65,fontSize:22,color:'#819083'}}>БАРХАТНЫЙ ШАР / {Math.floor(seconds/60).toString().padStart(2,'0')}:{Math.floor(seconds%60).toString().padStart(2,'0')}</div>
 <div style={{position:'absolute',top:125,left:90,right:90,height:1,background:'#c9cdbb'}}/>
 <div style={{position:'absolute',left:100,top:220,width:765,opacity,translate:`0px ${interpolate(local,[0,18],[18,0],{extrapolateRight:'clamp'})}px`}}>
 <div style={{fontSize:24,color:'#a38450',letterSpacing:4,marginBottom:38}}>{shot.chapter}</div>
 <div style={{fontFamily:'Georgia, serif',fontSize:hero?105:86,lineHeight:1.08,letterSpacing:-3,marginBottom:38,maxWidth:760}}>{shot.title}</div>
 <div style={{fontSize:35,lineHeight:1.5,maxWidth:690,color:'#486253'}}>{shot.text}</div>
 {shot.detail&&<div style={{borderLeft:'3px solid #bea16d',paddingLeft:24,marginTop:35,color:'#887243',fontSize:27,lineHeight:1.45,maxWidth:650}}>{shot.detail}</div>}
 {shot.kind==='materials'&&<div style={{fontSize:27,lineHeight:1.8,marginTop:22}}>✓ Основа и бархат<br/>✓ Клей и инструменты<br/>✓ Декор, шапочка и лента</div>}
 {shot.kind==='contact'&&<div style={{marginTop:35,fontSize:40,color:'#a38450'}}>t.me/SoulHomeRuBot</div>}
 </div>
 <div style={{position:'absolute',left:920,top:155,width:890,height:740,opacity}}><Img src={staticFile(`steps/step-${String(step).padStart(2,'0')}.png`)} style={{width:'100%',height:'100%',objectFit:'contain'}}/></div>
 <div style={{position:'absolute',bottom:95,left:100,right:100,display:'flex',gap:20,alignItems:'center'}}>
 <span style={{fontSize:21,color:'#839184',minWidth:95}}>ШАГ ЗА ШАГОМ</span>
 <div style={{height:3,background:'#d7d8ca',flex:1}}><div style={{height:3,width:`${(seconds/540)*100}%`,background:'#b69860'}}/></div>
 <span style={{fontSize:22,color:'#839184'}}>09:00</span>
 </div>
 <div style={{position:'absolute',bottom:45,left:100,fontSize:20,color:'#8b9688'}}>Пошаговый урок · Soul Home</div>
 <div style={{position:'absolute',bottom:45,right:100,fontSize:20,color:'#8b9688'}}>СОЗДАНО С ТЕПЛОМ</div>
 </AbsoluteFill>;
};
export const LessonScene=Interactive.create({Component:SceneInner,layout:'absolute-fill'});
export const Lesson:React.FC=()=>{const {fps}=useVideoConfig();return <Track name="Главы урока">
 <LessonScene name="Вступление" start={0} end={30} durationInFrames={30*fps}/>
 <LessonScene name="Материалы" start={30} end={90} from={30*fps} durationInFrames={60*fps}/>
 <LessonScene name="Обтяжка" start={90} end={270} from={90*fps} durationInFrames={180*fps}/>
 <LessonScene name="Декор" start={270} end={360} from={270*fps} durationInFrames={90*fps}/>
 <LessonScene name="Крепление" start={360} end={405} from={360*fps} durationInFrames={45*fps}/>
 <LessonScene name="Проверка" start={405} end={450} from={405*fps} durationInFrames={45*fps}/>
 <LessonScene name="Результат" start={450} end={510} from={450*fps} durationInFrames={60*fps}/>
 <LessonScene name="Советы" start={510} end={540} from={510*fps} durationInFrames={30*fps}/>
 </Track>};
export const LessonCompositions=()=> <>
 <Composition id="VelvetBallLesson" component={Lesson} durationInFrames={16200} fps={30} width={1920} height={1080}/>
 <Composition id="LessonScene" component={LessonScene} durationInFrames={5400} fps={30} width={1920} height={1080} defaultProps={{start:90,end:270}}/>
 </>;

