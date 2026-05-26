(function(){
  const t=sessionStorage.getItem('schiller_token');
  if(!t) window.location.href='login.html';
})();