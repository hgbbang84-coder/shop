const header=document.querySelector('header');
if(header){
  header.innerHTML='<a class="nav-slot" href="/">상품 목록</a><a class="nav-slot" href="/cart.html">장바구니</a><a class="nav-slot" href="/account.html">마이페이지</a><a class="nav-slot" id="auth-action" href="/login.html">로그아웃</a><a class="nav-slot" id="signup-action" href="/signup.html">회원가입</a><span class="auth-status" id="auth-status">로그인 안 함</span>';
  const action=document.querySelector('#auth-action'),signup=document.querySelector('#signup-action'),status=document.querySelector('#auth-status');
  action.style.width=`${action.getBoundingClientRect().width}px`;action.textContent='로그인';status.style.marginLeft='auto';
  (async()=>{try{const response=await fetch('/api/me');if(!response.ok)return;const user=await response.json();action.textContent='로그아웃';action.href='#';action.addEventListener('click',async event=>{event.preventDefault();await fetch('/api/auth/logout',{method:'POST'});location='/login.html'});signup.style.visibility='hidden';signup.style.pointerEvents='none';status.textContent=`${user.name}님 로그인됨`;}catch{}})();
}
