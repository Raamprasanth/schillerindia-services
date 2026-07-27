(function(){
  document.documentElement.setAttribute('data-theme',localStorage.getItem('si_theme')||'light');
  const t=sessionStorage.getItem('schiller_token');
  if(!t)window.location.href='login.html';
})();