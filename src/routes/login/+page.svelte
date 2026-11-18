<script lang="ts">
  import { goto } from '$app/navigation';
  let password = '';
  let busy = false;
  let message = '';
  async function submit() {
    busy = true; message = '';
    try {
      const res = await fetch('/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});
      if (res.ok) {password='';await goto('/');}
      else message = res.status===429?'Zu viele Versuche. Bitte später erneut probieren.':'Passwort falsch / Incorrect password';
    } catch {message='Verbindung fehlgeschlagen / Connection failed';}
    busy=false;
  }
</script>
<svelte:head><title>Login · Smart Shopping Assistant</title></svelte:head>
<main class="login">
  <section class="card">
    <div class="logo">🛒</div>
    <h1>Smart Shopping</h1><p>Dein privater Haushaltsassistent</p>
    <form onsubmit={(e)=>{e.preventDefault();submit();}}>
      <label for="password">Gemeinsames Passwort / Shared password</label>
      <input id="password" type="password" bind:value={password} maxlength="1024" required autocomplete="current-password" />
      {#if message}<p role="alert" class="error">{message}</p>{/if}
      <button type="submit" disabled={busy}>{busy?'…':'Anmelden / Sign in'}</button>
    </form>
  </section>
</main>
<style>
  .login{min-height:100vh;display:grid;place-items:center;background:#111419;color:#f4f7f6;font-family:system-ui,sans-serif;padding:20px}
  .card{width:min(100%,430px);padding:36px;background:#1e252d;border:1px solid #35404c;border-radius:24px;text-align:center}
  .logo{font-size:44px}h1{font-size:29px;margin:10px 0}p{color:#aab4bf}form{text-align:left;margin-top:26px;display:grid;gap:12px}
  label{font-size:13px;color:#cdd6df}input{height:50px;border-radius:11px;background:#131920;border:1px solid #647080;color:white;padding:0 14px}
  button{margin-top:8px;height:50px;background:#a7f3d0;color:#14221f;border:0;border-radius:12px;font-weight:700;cursor:pointer}
  button:disabled{opacity:.55}.error{color:#ff9696}
</style>
