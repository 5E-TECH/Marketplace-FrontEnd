/**
 * Tablar orasida sessiya (FE-02 TC2: «ikkinchi tab ochildi → qayta login so'ralmaydi").
 *
 * Token har tabning o'z `sessionStorage` ida (XSS qolgan tablarga yoyilmasin — localStorage'ga
 * yozilmaydi). Yangi tab sessiyasini shunday tiklaydi:
 *  1. ochiq tablardan so'raydi (BroadcastChannel, bir xil origin) — tez va serverga so'rovsiz;
 *  2. javob bo'lmasa — refresh cookie orqali `POST /auth/refresh`.
 *
 * Backend refresh token'ni har refresh'da almashtiradi va eskisini darhol bekor qiladi
 * (identity `auth.service.ts` — imtiyozli oraliq yo'q). Ikki tab bir vaqtda refresh qilsa,
 * kechikkani 401 olib chiqib ketardi — shuning uchun refresh tablar bo'ylab navbat bilan
 * (`navigator.locks`): ikkinchisi birinchisi yangilagan cookie bilan so'raydi.
 */
const CHANNEL_NAME = 'elchi-auth';
/** «Bu brauzerda sessiya bo'lishi mumkin» belgisi (token emas) — anonim kirishda bekorga refresh qilinmasin. */
const SESSION_HINT_KEY = 'elchi_session_hint';
const REFRESH_LOCK = 'elchi-auth-refresh';
const PEER_TIMEOUT_MS = 300;

export interface SharedSession {
  /** `null` — cookie rejimi (`AUTH_TOKENS_IN_BODY=false`): token HttpOnly cookie'da. */
  accessToken: string | null;
}

type SyncMessage =
  | { type: 'session-request'; id: string }
  | { type: 'session-response'; id: string; session: SharedSession }
  | { type: 'logout' };

function openChannel(): BroadcastChannel | null {
  try {
    return typeof BroadcastChannel === 'function' ? new BroadcastChannel(CHANNEL_NAME) : null;
  } catch {
    return null;
  }
}

function isSyncMessage(value: unknown): value is SyncMessage {
  return typeof value === 'object' && value !== null && 'type' in value && typeof value.type === 'string';
}

export const sessionHint = {
  has(): boolean {
    try {
      return localStorage.getItem(SESSION_HINT_KEY) === '1';
    } catch {
      return false;
    }
  },
  set(): void {
    try {
      localStorage.setItem(SESSION_HINT_KEY, '1');
    } catch {
      // Storage bloklangan — yangi tab login so'raydi, xolos.
    }
  },
  clear(): void {
    try {
      localStorage.removeItem(SESSION_HINT_KEY);
    } catch {
      // Ahamiyatsiz.
    }
  },
};

/** Ochiq tablardan sessiya so'raydi; 300 ms ichida javob bo'lmasa `null`. */
export function requestSessionFromPeers(timeoutMs = PEER_TIMEOUT_MS): Promise<SharedSession | null> {
  const channel = openChannel();
  if (!channel) return Promise.resolve(null);
  const id = Math.random().toString(36).slice(2);
  return new Promise((resolve) => {
    const finish = (session: SharedSession | null) => {
      window.clearTimeout(timer);
      channel.close();
      resolve(session);
    };
    const timer = window.setTimeout(() => finish(null), timeoutMs);
    channel.onmessage = (event: MessageEvent<unknown>) => {
      const message = event.data;
      if (isSyncMessage(message) && message.type === 'session-response' && message.id === id) finish(message.session);
    };
    channel.postMessage({ type: 'session-request', id } satisfies SyncMessage);
  });
}

interface PeerHandlers {
  /** Shu tabning faol sessiyasi; ulashib bo'lmasa (yo'q yoki «nomidan kirish») — `null`. */
  getSession: () => SharedSession | null;
  /** Boshqa tabda «Chiqish» bosildi. */
  onPeerLogout: () => void;
}

/** Boshqa tablarning so'rovlariga javob beradi va ularning chiqishini tinglaydi. Qaytgani — o'chirish. */
export function listenToPeers({ getSession, onPeerLogout }: PeerHandlers): () => void {
  const channel = openChannel();
  if (!channel) return () => undefined;
  channel.onmessage = (event: MessageEvent<unknown>) => {
    const message = event.data;
    if (!isSyncMessage(message)) return;
    if (message.type === 'session-request') {
      const session = getSession();
      if (session) channel.postMessage({ type: 'session-response', id: message.id, session } satisfies SyncMessage);
    } else if (message.type === 'logout') {
      onPeerLogout();
    }
  };
  return () => channel.close();
}

/** Shu tabda qo'lda chiqildi — qolgan tablar ham chiqadi. */
export function broadcastLogout(): void {
  const channel = openChannel();
  if (!channel) return;
  channel.postMessage({ type: 'logout' } satisfies SyncMessage);
  channel.close();
}

/** Refresh'ni tablar bo'ylab navbat bilan bajaradi (Web Locks bo'lmasa — oddiy chaqiruv). */
export function withRefreshLock<T>(task: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  return locks ? (locks.request(REFRESH_LOCK, () => task()) as Promise<T>) : task();
}
