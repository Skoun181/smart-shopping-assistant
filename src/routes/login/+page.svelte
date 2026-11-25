<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import type { PageData } from './$types';
  export let data:PageData;
  let password='',confirmation='',setupToken='',busy=false,message='';
  $: setup=data.loginState==='setup';
  $: locked=data.loginState==='locked';
  async function submit(){
    if(busy||locked)return;
    message='';
    if(setup&&(password.length<12||new TextEncoder().encode(password).length>1024||password!==confirmation)){
      message='Mindestens 12 Zeichen eingeben und das Passwort wiederholen.';return;
    }
    busy=true;
    try{
      const res=await fetch('/api/v1/auth/'+(setup?'setup':'login'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(setup?{password,confirmation,setupToken}:{password})});
      if(res.ok){password='';confirmation='';await goto('/',{invalidateAll:true});}
      else if(res.status===409){password='';confirmation='';await invalidateAll();message='Anmeldestatus geändert. Bitte erneut prüfen.';}
      else if(res.status===429)message='Zu viele Versuche. Bitte später erneut probieren.';
      else if(res.status===401)message='Passwort falsch / Incorrect password';
      else if(res.status===403&&setup)message='Setup-Token ungültig oder Zugriff abgelehnt.';
      else if(res.status===400)message='Passwort oder Bestätigung ungültig.';
      else message='Anmeldung konnte nicht verarbeitet werden. Bitte Server-Logs prüfen.';
    }catch{message='Verbindung fehlgeschlagen / Connection failed';}
    finally{busy=false;}
  }
</script>
<svelte:head><title>{setup?'Create Login':'Login'} · Smart Shopping Assistant</title></svelte:head>
<main class="login">
  <section class="card">
    <div class="logo">🛒</div>
    <h1>{setup?'Create Login':'Smart Shopping'}</h1>
    <p>{setup?'Richte dein gemeinsames Passwort ein. Kein Benutzername erforderlich.':'Dein privater Haushaltsassistent'}</p>
    {#if locked}
      <div class="notice" role="alert"><strong>Login-Einrichtung gesperrt</strong><p>Diese bestehende Installation hat kein gültiges gespeichertes Passwort. Der Serverbesitzer muss die Einrichtung lokal freigeben. Siehe README – Passwort zurücksetzen.</p></div>
    {:else}
      {#if setup}<p class="notice">Einmalige Einrichtung. Verwende mindestens 12 Zeichen. Richte die App ausschließlich in einem vertrauenswürdigen privaten Netz ein.</p>{/if}
      <form onsubmit={(e)=>{e.preventDefault();submit();}}>
        <label for="password">{setup?'Neues gemeinsames Passwort':'Gemeinsames Passwort / Shared password'}</label>
        <input id="password" type="password" bind:value={password} minlength={setup?12:1} maxlength="1024" required disabled={busy} autocomplete={setup?'new-password':'current-password'} />
        {#if setup}
          <label for="setup-token">Einmaliges Setup-Token</label>
          <input id="setup-token" type="password" bind:value={setupToken} maxlength="256" required disabled={busy} autocomplete="off" />
          <label for="confirmation">Passwort wiederholen</label>
          <input id="confirmation" type="password" bind:value={confirmation} minlength="12" maxlength="1024" required disabled={busy} autocomplete="new-password"/>
        {/if}
        {#if message}<p role="alert" class="error">{message}</p>{/if}
        <button type="submit" disabled={busy}>{busy?'Bitte warten …':setup?'Passwort erstellen / Create Login':'Anmelden / Sign in'}</button>
      </form>
    {/if}
  </section>
</main>
<style>
  .login{min-height:100vh;display:grid;place-items:center;background:#111419;color:#f4f7f6;font-family:system-ui,sans-serif;padding:20px}
  .card{box-sizing:border-box;width:min(100%,430px);padding:36px;background:#1e252d;border:1px solid #35404c;border-radius:24px;text-align:center}
  .logo{font-size:44px}h1{font-size:29px;margin:10px 0}p{color:#aab4bf}form{text-align:left;margin-top:26px;display:grid;gap:12px}
  label{font-size:13px;color:#cdd6df}input{height:50px;border-radius:11px;background:#131920;border:1px solid #647080;color:white;padding:0 14px;min-width:0}
  button{margin-top:8px;height:50px;background:#a7f3d0;color:#14221f;border:0;border-radius:12px;font-weight:700;cursor:pointer}
  button:disabled{opacity:.55}.error{color:#ff9696}.notice{margin-top:18px;padding:12px;font-size:13px;text-align:left;background:#131920;border:1px solid #647080;border-radius:11px;line-height:1.5}
</style>
