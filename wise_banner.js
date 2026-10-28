(()=>{
  if(document.getElementById('wise-floating-banner')) return;
  const booking='https://pcmap.place.naver.com/place/21125158/ticket?bk_query=%ED%95%98%EB%82%A8%EC%99%80%EC%9D%B4%EC%A6%88%EB%A7%8C&entry=pll&from=map&fromPanelNum=2&timestamp=202610281248&locale=ko&svcName=map_pcv5&searchText=%ED%95%98%EB%82%A8%EC%99%80%EC%9D%B4%EC%A6%88%EB%A7%8C';
  const style=document.createElement('style');
  style.textContent=`
  #wise-floating-banner{position:fixed;z-index:9999;top:15%;right:18px;width:clamp(135px,13vw,210px);filter:drop-shadow(0 9px 17px rgba(69,33,0,.18));animation:wiseBeat 3.2s ease-in-out infinite;transform-origin:50% 50%;}
  #wise-floating-banner .wise-banner-image{display:block;width:100%;height:auto;border:0;border-radius:13px;}
  #wise-floating-banner .wise-banner-link{display:block;cursor:pointer;border-radius:13px;overflow:hidden;}
  #wise-floating-banner .wise-banner-close{position:absolute;right:0;top:0;width:18%;aspect-ratio:1;border:0;background:transparent;cursor:pointer;z-index:2;font-size:0;}
  #wise-floating-banner .wise-banner-close:focus-visible,#wise-floating-banner .wise-banner-link:focus-visible{outline:3px solid #1b2f8d;outline-offset:3px;}
  @keyframes wiseBeat{0%,78%,100%{transform:translateY(0) scale(1)}83%{transform:translateY(-5px) scale(1.035)}88%{transform:translateY(0) scale(1)}93%{transform:translateY(-3px) scale(1.02)}}
  @media(max-width:768px){#wise-floating-banner{top:auto;bottom:14px;right:10px;width:min(30vw,135px);}}
  @media(prefers-reduced-motion:reduce){#wise-floating-banner{animation:none}}
  `;
  document.head.appendChild(style);
  const wrapper=document.createElement('aside'); wrapper.id='wise-floating-banner';wrapper.setAttribute('aria-label','와이즈데이 수학 과학 무료 진단검사 신청');
  const link=document.createElement('a');link.className='wise-banner-link';link.href=booking;link.target='_blank';link.rel='noopener noreferrer';link.setAttribute('aria-label','와이즈데이 무료 진단검사 네이버 예약 페이지 열기');
  const img=document.createElement('img');img.className='wise-banner-image';img.src='/assets/wise_day_2026_banner.webp';img.alt='와이즈데이 2026년 11월 7일부터 12월 12일까지 수학 과학 진단검사 무료, 7세부터 중학교 3학년 대상. 신청하기';
  link.appendChild(img);
  const close=document.createElement('button');close.type='button';close.className='wise-banner-close';close.setAttribute('aria-label','광고 배너 닫기');close.title='닫기';close.addEventListener('click',()=>wrapper.remove());
  wrapper.append(link,close);document.body.append(wrapper);
})();
