(function(){
  const token = sessionStorage.getItem('schiller_token');
  if (!token) window.location.href = 'login.html';
})();