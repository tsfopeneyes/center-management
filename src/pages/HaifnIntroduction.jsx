import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import HaifnChatSheet from '../components/HaifnChatSheet';
import './HaifnIntroduction.css';
import { recordWelcomeQrVisit } from '../utils/welcomeQrVisits';
const topics=['공간 소개','우리 이야기','운영 재단','활동','스쿨처치','방문 초대'];
const titles=['여기, 뭐 하는 곳이지?','일상에서 하나님 나라를 누려요!','이 공간을 만든 사람들은?','오늘은 뭐 하고 놀까?','우리 학교에도 함께 예배할 친구가 있을까?','하이픈에 오신 여러분을 환영합니다! 우리 2층에서 만나요!'];
const copy=[
['같이 밥 먹고, 보드게임 하고, 친구들과 이야기하다가 하나님 이야기도 나누는 곳.','학교와 교회 사이, 일상과 신앙을 연결하는 하이픈입니다!'],
['학교에서 있었던 일, 요즘 좋아하는 것, 혼자 고민하던 이야기까지.','서로의 삶과 이야기를 나누며 하나님 나라의 기쁨을 누리는 자리에 함께하고 싶어요!'],
['청소년이 좋아하는 것을 발견하고, 꿈을 키워갈 수 있도록 함께하는 (재)더작은재단이 운영해요.','2014년에 설립된 문화체육관광부 소관 비영리 재단이에요.','함께하는 곳: 장로회신학대학교 기독교교육리더십연구소, 좋은교사 학교복음사역위원회, 스탠드그라운드, 학교기도불씨운동'],
['EAT — 같이 먹으면 더 맛있는 한 끼','PLAY — 보드게임 한 판? 네 컷 사진? 릴스 촬영?','TALK — 시시콜콜한 수다부터 진지한 고민까지','CREATE — 만들고, 꾸미고, 우리답게 표현하고','WORSHIP — 평범한 하루 속에서도 하나님을 만나요'],
['학교에서 신앙 이야기를 나누고, 함께 기도하고 예배하는 모임. 우리는 스쿨처치라고 불러요.','모임을 시작하고 싶을 때도, 친구들과 더 가까워지고 싶을 때도, 다른 학교의 친구들을 만나고 싶을 때도.','하이픈에서 함께 만들어가요.'],
['여기까지 읽었다면 하이픈이 조금 궁금해졌나요? 가볍게 들어와서 함께 인사 나눠요!']];
const posterAssets=[1,2,3,4,5,6].map(n=>`/brand/center/welcome-layout-${n}.png?v=20261001d`);
const posterGrounds=['#f7efe2','#f7efe2','#f7efe2','#f7efe2','#f7efe2','#cf3a27'];
const bandMasks=['0,32.6 100,45.1 100,70.3 0,57.8','0,40.2 100,49.8 100,56.5 0,47.3','0,24.7 100,37.3 100,50 0,38.6','0,20.6 100,37.2 100,57.1 0,45.4','0,28 100,34.3 100,57.8 0,51','0,0 100,0 100,100 0,100'];
const BrandPalette=()=> <svg width="0" height="0" aria-hidden="true" className="hi-palette-defs"><defs>{bandMasks.map((points,index)=>
  <filter key={index} id={`hi-brand-palette-${index}`} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
    <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 10 10 10 0 -24.4" result="light"/>
    <feComponentTransfer in="light" result="lightMask"><feFuncA type="discrete" tableValues="0 1"/></feComponentTransfer>
    <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 -1 0 1 0 .65" result="neutral"/>
    <feComponentTransfer in="neutral" result="neutralMask"><feFuncA type="discrete" tableValues="0 1"/></feComponentTransfer>
    <feComposite in="lightMask" in2="neutralMask" operator="in" result="creamMask"/>
    <feFlood floodColor="#F7EFE2" result="cream"/>
    <feComposite in="cream" in2="creamMask" operator="in" result="creamFill"/>
    <feComposite in="SourceGraphic" in2="creamMask" operator="out" result="nonCream"/>
    <feMerge result="creamBase"><feMergeNode in="nonCream"/><feMergeNode in="creamFill"/></feMerge>
    <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 1 -1 0 0 .25" result="redDominant"/>
    <feComponentTransfer in="redDominant" result="redMaskA"><feFuncA type="discrete" tableValues="0 1"/></feComponentTransfer>
    <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 1 -1 0 .465" result="warmRed"/>
    <feComponentTransfer in="warmRed" result="redMaskB"><feFuncA type="discrete" tableValues="0 1"/></feComponentTransfer>
    <feComposite in="redMaskA" in2="redMaskB" operator="in" result="redPixels"/>
    <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 -1 0 0 .83" result="deepRed"/>
    <feComponentTransfer in="deepRed" result="deepRedMask"><feFuncA type="discrete" tableValues="0 1"/></feComponentTransfer>
    <feComposite in="redPixels" in2="deepRedMask" operator="in" result="backgroundRedPixels"/>
    <feImage href={`data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="${points}" fill="white"/></svg>`)}`} preserveAspectRatio="none" result="bandRegion"/>
    <feColorMatrix in="bandRegion" type="luminanceToAlpha" result="bandMask"/>
    <feComposite in={index===5?'backgroundRedPixels':'redPixels'} in2="bandMask" operator="in" result="redMask"/>
    <feFlood floodColor="#CF3A27" result="red"/>
    <feComposite in="red" in2="redMask" operator="in" result="redFill"/>
    <feComposite in="creamBase" in2="redMask" operator="out" result="nonRed"/>
    <feMerge><feMergeNode in="nonRed"/><feMergeNode in="redFill"/></feMerge>
  </filter>)}
</defs></svg>;
export default function HaifnIntroduction(){
useEffect(()=>{ recordWelcomeQrVisit(); },[]);
const sections=useRef([]); const [active,setActive]=useState(0); const [questionOpen,setQuestionOpen]=useState(false);
useEffect(()=>{const oldTitle=document.title;document.title='HAIFN | 일상과 신앙이 연결되는 곳';const observer=new IntersectionObserver(entries=>{const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];if(visible)setActive(Number(visible.target.dataset.page));},{threshold:[.25,.45,.65]});sections.current.forEach(e=>e&&observer.observe(e));return()=>{observer.disconnect();document.title=oldTitle;};},[]);
const goTo=i=>{sections.current[i]?.scrollIntoView({behavior:'instant',block:'start'});setActive(i);};
return <main className="hi-page hi-complete-series">
  <BrandPalette/>
  <header className="hi-poster-header" data-invitation={active===topics.length-1} aria-label="하이픈"><span>HAIFN</span></header>
  {topics.map((topic,index)=>{
    const Heading=index===0?'h1':'h2';
    return <section key={topic} id={`haifn-section-${index+1}`}
      ref={node=>{sections.current[index]=node;}} data-page={index} data-active={index===active}
      className={`hi-section hi-complete-section ${index===5?'hi-complete-red':''}`}
      aria-label={`${index+1}번째 화면`} style={{backgroundColor:posterGrounds[index]}}>
      <div className="hi-complete-canvas">
        <img className="hi-complete-art" style={{filter:`url(#hi-brand-palette-${index})`}} src={posterAssets[index]} alt="" loading={index<2?'eager':'lazy'}/>
        <div className="sr-only"><Heading>{titles[index]}</Heading>{copy[index].map(text=><p key={text}>{text}</p>)}</div>
        {index===5&&<button type="button" className="hi-complete-chat" aria-label="더 궁금한 게 있나요?" onClick={()=>setQuestionOpen(true)}/>}
      </div>
        <nav aria-label={`${index+1}페이지 화면 이동`} className="hi-complete-controls">
          <button type="button" className="hi-quiet-prev" aria-label="이전 화면" disabled={index===0} onClick={()=>goTo(index-1)}><ArrowLeft size={21}/></button>
          <div className="hi-raster-dots">{topics.map((name,i)=><button key={name} type="button" aria-label={`${i+1}번째 화면: ${name}`} aria-current={i===active?'step':undefined} onClick={()=>goTo(i)}><span className={i===index?'is-active':''}/></button>)}</div>
          <button type="button" className="hi-quiet-next" aria-label={index===5?'처음으로':'다음 화면'} onClick={()=>goTo(index===5?0:index+1)}><ArrowRight size={23}/></button>
        </nav>
    </section>;
  })}
  {questionOpen&&<HaifnChatSheet onClose={()=>setQuestionOpen(false)}/>}
</main>;
}



