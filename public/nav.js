const header=document.querySelector('header');
if(header){
  header.innerHTML='<a class="nav-slot" href="/">상품 목록</a><a class="nav-slot" href="/cart">장바구니</a><a class="nav-slot" href="/account">마이페이지</a><a class="nav-slot" id="auth-action" href="/login">로그아웃</a><a class="nav-slot" id="signup-action" href="/signup">회원가입</a><span class="auth-status" id="auth-status">로그인 안 함</span>';
  const action=document.querySelector('#auth-action'),signup=document.querySelector('#signup-action'),status=document.querySelector('#auth-status');
  action.style.width=`${action.getBoundingClientRect().width}px`;action.textContent='로그인';status.style.marginLeft='auto';
  const me=fetch('/api/me').then(response=>response.ok?response.json():null).catch(()=>null);window.shopMe=me;
  (async()=>{const user=await me;if(!user)return;action.textContent='로그아웃';action.href='#';action.addEventListener('click',async event=>{event.preventDefault();await fetch('/api/auth/logout',{method:'POST'});location='/login'});signup.style.visibility='hidden';signup.style.pointerEvents='none';status.textContent=`${user.name}님 로그인됨`;})();
}
