import { afterEach, describe, expect, it, vi } from 'vitest';
import { broadcastLogout, listenToPeers, requestSessionFromPeers, sessionHint, withRefreshLock } from './sessionSync';

describe('sessionSync (TC2: tablar orasida sessiya)', () => {
  const stops: Array<() => void> = [];
  afterEach(() => {
    stops.splice(0).forEach((stop) => stop());
    sessionHint.clear();
  });

  it('ochiq tab o‘z sessiyasini yangi tabga beradi', async () => {
    stops.push(listenToPeers({ getSession: () => ({ accessToken: 'tab-1-token' }), onPeerLogout: vi.fn() }));
    await expect(requestSessionFromPeers()).resolves.toEqual({ accessToken: 'tab-1-token' });
  });

  it('sessiyasi yo‘q yoki ulashib bo‘lmaydigan tab javob bermaydi — 300 ms da null', async () => {
    stops.push(listenToPeers({ getSession: () => null, onPeerLogout: vi.fn() }));
    await expect(requestSessionFromPeers(50)).resolves.toBeNull();
  });

  it('bir tabda chiqish — boshqasi xabar oladi', async () => {
    const onPeerLogout = vi.fn();
    stops.push(listenToPeers({ getSession: () => null, onPeerLogout }));
    broadcastLogout();
    await vi.waitFor(() => expect(onPeerLogout).toHaveBeenCalledOnce());
  });

  it('sessiya belgisi token emas, faqat «1»', () => {
    expect(sessionHint.has()).toBe(false);
    sessionHint.set();
    expect(localStorage.getItem('elchi_session_hint')).toBe('1');
    expect(sessionHint.has()).toBe(true);
  });

  it('refresh navbat bilan: ikkinchisi birinchisi tugagach boshlanadi', async () => {
    const order: string[] = [];
    const task = (name: string) => () => new Promise<string>((resolve) => {
      order.push(`${name}:start`);
      setTimeout(() => { order.push(`${name}:end`); resolve(name); }, 20);
    });
    await Promise.all([withRefreshLock(task('a')), withRefreshLock(task('b'))]);
    if (typeof navigator !== 'undefined' && navigator.locks) {
      expect(order).toEqual(['a:start', 'a:end', 'b:start', 'b:end']);
    } else {
      expect(order).toHaveLength(4);
    }
  });
});
