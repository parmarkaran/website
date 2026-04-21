/* ============================================================
   CharacterVerse — Chat Encryption
   AES-256-GCM  ·  PBKDF2(SHA-256, 100 000 iterations)
   Requires a secure context (localhost or HTTPS).
   On plain HTTP (e.g. phone via LAN), gracefully skips encryption.
============================================================ */

const ENC_SALT_KEY  = 'cv_enc_salt';    // base64-encoded 16-byte PBKDF2 salt
const ENC_CHECK_KEY = 'cv_enc_check';   // encrypted sentinel to verify correct password

let _ck = null;   // active CryptoKey held in memory for this session only

// ── Availability check ────────────────────────────────────────
const _canEncrypt = !!(window.crypto && window.crypto.subtle);

// ── Helpers ───────────────────────────────────────────────────

/** Uint8Array → base64 string (safe for large buffers) */
function _toB64(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
}

/** base64 string → Uint8Array */
function _fromB64(b64) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

async function _deriveKey(password, salt) {
  const km = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    km,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/** Encrypt a plaintext string → 'ENC:<base64>' */
async function _aesEncrypt(key, plaintext) {
  const iv  = crypto.getRandomValues(new Uint8Array(12));
  const buf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext)
  );
  const out = new Uint8Array(12 + buf.byteLength);
  out.set(iv);
  out.set(new Uint8Array(buf), 12);
  return _toB64(out);
}

/** Decrypt a base64 AES-GCM payload back to string */
async function _aesDecrypt(key, b64) {
  const raw = _fromB64(b64);
  const buf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: raw.slice(0, 12) }, key, raw.slice(12)
  );
  return new TextDecoder().decode(buf);
}

// ── Public encrypt / decrypt ──────────────────────────────────

/**
 * Encrypt a string. Returns 'ENC:<base64>' or the original string if
 * crypto is unavailable / key not loaded.
 */
async function encryptData(plaintext) {
  if (!_ck || !plaintext) return plaintext;
  return 'ENC:' + await _aesEncrypt(_ck, plaintext);
}

/**
 * Decrypt a string. Transparently passes through legacy plaintext.
 * Returns null if decryption fails with the current key.
 */
async function decryptData(data) {
  if (!data) return data;
  if (!data.startsWith('ENC:')) return data;   // legacy plaintext — pass through
  if (!_ck) return null;
  try {
    return await _aesDecrypt(_ck, data.slice(4));
  } catch {
    return null;  // wrong key or corrupted data
  }
}

// ── Password setup / unlock ───────────────────────────────────

function isPasswordSet() {
  return !!localStorage.getItem(ENC_SALT_KEY);
}

/** First-time setup: derive key, store salt + sentinel, migrate existing data */
async function _setup(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  _ck = await _deriveKey(password, salt);
  localStorage.setItem(ENC_SALT_KEY, _toB64(salt));
  localStorage.setItem(ENC_CHECK_KEY, await _aesEncrypt(_ck, 'cv_sentinel_ok'));
  await _migrateExisting();
}

/** Unlock with existing password — returns true on success */
async function _unlock(password) {
  const saltB64 = localStorage.getItem(ENC_SALT_KEY);
  if (!saltB64) return false;
  const salt = _fromB64(saltB64);
  const key  = await _deriveKey(password, salt);
  try {
    const plain = await _aesDecrypt(key, localStorage.getItem(ENC_CHECK_KEY));
    if (plain !== 'cv_sentinel_ok') return false;
    _ck = key;
    return true;
  } catch {
    return false;
  }
}

/** Encrypt any existing plaintext cv_convs_* / cv_folders_* entries */
async function _migrateExisting() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && (k.startsWith('cv_convs_') || k.startsWith('cv_folders_'))) keys.push(k);
  }
  for (const k of keys) {
    const v = localStorage.getItem(k);
    if (v && !v.startsWith('ENC:')) {
      localStorage.setItem(k, await encryptData(v));
    }
  }
}

/** Wipe all cv_ data — used when user forgets password */
function _clearAllData() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k) keys.push(k);
  }
  keys.filter(k => k.startsWith('cv_')).forEach(k => localStorage.removeItem(k));
  _ck = null;
}

// ── Modal UI ──────────────────────────────────────────────────

/**
 * No-op — encryption/password prompt disabled.
 * Chats are stored in plain localStorage.
 */
function initCrypto() {
  _ck = null;  // no key active
  return Promise.resolve();
}

function _showNonSecureBanner() {
  const b = document.createElement('div');
  b.style.cssText = [
    'position:fixed;bottom:1.2rem;left:50%;transform:translateX(-50%)',
    'background:rgba(40,30,80,.95);border:1px solid rgba(255,180,0,.45)',
    'color:#ffd070;font-size:.78rem;padding:.55rem 1.1rem',
    'border-radius:10px;z-index:9999;text-align:center',
    'box-shadow:0 4px 20px rgba(0,0,0,.5)',
  ].join(';');
  b.textContent = '🔓 Encryption requires HTTPS or localhost. Chats on this device are stored locally (unencrypted).';
  document.body.appendChild(b);
  setTimeout(() => b.remove(), 9000);
}

function _showModal(onDone) {
  document.getElementById('cv-lock-modal')?.remove();

  const setup = !isPasswordSet();

  const overlay = document.createElement('div');
  overlay.id = 'cv-lock-modal';
  overlay.style.cssText = [
    'position:fixed;inset:0;z-index:99999',
    'display:flex;align-items:center;justify-content:center',
    'background:rgba(5,5,20,0.97)',
    'backdrop-filter:blur(10px)',
    'font-family:Inter,sans-serif',
  ].join(';');

  overlay.innerHTML = `
    <div style="
      background:linear-gradient(135deg,rgba(30,30,60,0.98),rgba(10,10,30,0.99));
      border:1px solid rgba(120,80,255,0.4);
      border-radius:22px;
      padding:2.8rem 2.2rem 2.4rem;
      width:min(92vw,400px);
      box-shadow:0 0 80px rgba(120,80,255,0.25),0 20px 60px rgba(0,0,0,0.6);
      text-align:center;
    ">
      <div style="font-size:3rem;margin-bottom:.9rem;filter:drop-shadow(0 0 16px rgba(160,100,255,.5))">${setup ? '🔐' : '🔒'}</div>
      <h2 style="margin:0 0 .5rem;color:#e0d8ff;font-size:1.35rem;font-weight:700;letter-spacing:-.01em">
        ${setup ? 'Set a Chat Password' : 'Unlock Your Chats'}
      </h2>
      <p style="margin:0 0 1.8rem;color:#7a7599;font-size:.84rem;line-height:1.55">
        ${setup
          ? 'Your conversations will be encrypted with <strong style="color:#b09fff">AES-256-GCM</strong>.<br>You\'ll need this password each time you open the site.'
          : 'Enter your password to decrypt and access your chats.'}
      </p>

      <input id="cv-pw1" type="password" placeholder="Password" autocomplete="${setup ? 'new-password' : 'current-password'}"
        style="width:100%;box-sizing:border-box;padding:.8rem 1rem;border-radius:11px;
          border:1px solid rgba(120,80,255,0.45);background:rgba(20,15,45,0.8);
          color:#e0d8ff;font-size:1rem;outline:none;margin-bottom:.75rem;
          transition:border-color .2s">

      ${setup ? `
      <input id="cv-pw2" type="password" placeholder="Confirm Password" autocomplete="new-password"
        style="width:100%;box-sizing:border-box;padding:.8rem 1rem;border-radius:11px;
          border:1px solid rgba(120,80,255,0.45);background:rgba(20,15,45,0.8);
          color:#e0d8ff;font-size:1rem;outline:none;margin-bottom:.75rem;
          transition:border-color .2s">
      ` : ''}

      <div id="cv-lock-err" style="color:#ff7070;font-size:.82rem;min-height:1.1em;margin-bottom:.8rem;font-weight:500"></div>

      <button id="cv-lock-btn"
        style="width:100%;padding:.85rem;border:none;border-radius:11px;
          background:linear-gradient(135deg,#7c4fff,#a855f7);
          color:#fff;font-size:1rem;font-weight:700;cursor:pointer;
          box-shadow:0 4px 20px rgba(124,79,255,.4);
          transition:opacity .2s,transform .1s">
        ${setup ? 'Encrypt &amp; Continue' : 'Unlock'}
      </button>

      ${!setup ? `
      <button id="cv-forgot-btn"
        style="margin-top:1.1rem;background:none;border:none;color:#4d4870;
          font-size:.77rem;cursor:pointer;text-decoration:underline;line-height:1.6">
        Forgot password? (permanently deletes all chat data)
      </button>` : ''}

      ${setup ? `
      <p style="margin-top:1.1rem;color:#4d4870;font-size:.75rem;line-height:1.5">
        ⚠ If you forget this password, your chats cannot be recovered.
      </p>` : ''}
    </div>`;

  document.body.appendChild(overlay);

  const pw1    = document.getElementById('cv-pw1');
  const pw2    = document.getElementById('cv-pw2');
  const btn    = document.getElementById('cv-lock-btn');
  const errEl  = document.getElementById('cv-lock-err');

  async function attempt() {
    const pw = pw1.value;
    errEl.textContent = '';
    if (!pw) { errEl.textContent = 'Please enter your password.'; return; }

    btn.disabled = true;
    btn.style.opacity = '0.7';
    btn.textContent   = setup ? 'Encrypting…' : 'Unlocking…';

    if (setup) {
      if (pw.length < 4) {
        errEl.textContent = 'Password must be at least 4 characters.';
        _resetBtn();
        return;
      }
      if (pw2 && pw !== pw2.value) {
        errEl.textContent = 'Passwords do not match.';
        _resetBtn();
        return;
      }
      await _setup(pw);
      overlay.remove();
      onDone();
    } else {
      const ok = await _unlock(pw);
      if (ok) {
        overlay.remove();
        onDone();
      } else {
        errEl.textContent = 'Incorrect password. Please try again.';
        _resetBtn();
        pw1.value = '';
        pw1.focus();
      }
    }

    function _resetBtn() {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.textContent = setup ? 'Encrypt & Continue' : 'Unlock';
    }
  }

  btn.addEventListener('click', attempt);
  pw1.addEventListener('keydown', e => { if (e.key === 'Enter') attempt(); });
  pw2?.addEventListener('keydown', e => { if (e.key === 'Enter') attempt(); });

  document.getElementById('cv-forgot-btn')?.addEventListener('click', () => {
    if (confirm(
      '⚠ WARNING\n\nThis will permanently delete ALL chat history and cannot be undone.\n\nAre you absolutely sure you want to continue?'
    )) {
      _clearAllData();
      overlay.remove();
      onDone();
    }
  });

  setTimeout(() => pw1.focus(), 80);
}
