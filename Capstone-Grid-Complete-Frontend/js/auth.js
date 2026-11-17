
document.querySelectorAll('[data-auth-form]').forEach(form=>{
 form.addEventListener('submit',e=>{
  e.preventDefault();const d=new FormData(form),role=form.dataset.role,action=form.dataset.action,msg=form.querySelector('.message');
  msg.className='message';msg.textContent='';
  if(!form.reportValidity())return;
  if(action==='register'&&d.get('password')!==d.get('confirmPassword')){msg.textContent='Passwords do not match.';msg.classList.add('error');return;}
  const users=JSON.parse(localStorage.getItem('cg_demo_users')||'[]');
  if(action==='register'){
   if(users.some(u=>u.email.toLowerCase()===String(d.get('email')).toLowerCase())){msg.textContent='This email is already registered in this browser demo.';msg.classList.add('error');return;}
   users.push({role,name:d.get('name'),email:d.get('email'),password:d.get('password'),studentId:d.get('studentId')||'',department:d.get('department')||'',designation:d.get('designation')||''});
   localStorage.setItem('cg_demo_users',JSON.stringify(users));
   msg.textContent='Demo account created. Redirecting to login...';msg.classList.add('success');
   setTimeout(()=>location.href='login.html',800);
  }else{
   const user=users.find(u=>u.role===role&&u.email.toLowerCase()===String(d.get('email')).toLowerCase()&&u.password===d.get('password'));
   if(!user){msg.textContent='Account not found or incorrect credentials. Register first in this browser demo.';msg.classList.add('error');return;}
   localStorage.setItem('cg_demo_session',JSON.stringify({role:user.role,name:user.name,email:user.email,department:user.department}));
   location.href='dashboard.html';
  }
 });
});
