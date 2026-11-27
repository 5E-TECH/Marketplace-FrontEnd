import { describe, expect, it } from 'vitest';
import type { AccountLock } from '../lib/accountLock';
import { accountLocked, authReducer, authenticated, currentUserLoaded, loggedOut, roleChangeSeen, sessionExpired, unknownRoleSeen } from './authSlice';
import type { AuthUser } from './authTypes';

/** FE-15 (umumiy-sessiya 6–9): hisob yopilishi va rol o'zgarishi holati. */
const laylo: AuthUser = { id: 'U-2087', role: 'OPERATOR_LEAD', name: 'Laylo Nazarova', phone: '+998900000009', email: null, avatarUrl: null, isActive: true, isDeleted: false, isBlocked: false };
const lock: AccountLock = { kind: 'BLOCKED', account: { id: 'U-2087', name: 'Laylo Nazarova', role: 'OPERATOR_LEAD', phone: null }, at: null, by: null, reason: null, evidence: null, basis: null, supervisorName: null, seller: null };
const start = () => authReducer(authReducer(undefined, authenticated({ accessToken: 'token' })), currentUserLoaded(laylo));

describe('authSlice: rol o‘zgarishi va hisob yopilishi', () => {
  it('o‘sha odam qayta kirdi, roli boshqa — «Rolingiz o‘zgardi»; boshqa odam yoki o‘sha rol — yo‘q', () => {
    let state = start();
    expect(state.roleChange).toBeNull();
    state = authReducer(state, currentUserLoaded({ ...laylo }));
    expect(state.roleChange).toBeNull();
    state = authReducer(state, sessionExpired());
    state = authReducer(state, currentUserLoaded({ ...laylo, role: 'SUPERVISOR' }));
    expect(state.roleChange).toEqual({ before: 'OPERATOR_LEAD', after: 'SUPERVISOR' });
    state = authReducer(state, roleChangeSeen());
    expect(state.roleChange).toBeNull();
    state = authReducer(state, currentUserLoaded({ ...laylo, id: 'U-0003', role: 'ADMIN' }));
    expect(state.roleChange).toBeNull();
  });

  it('noma’lum rol → sessiya tugadi → login: «Oldin: Noma’lum rol»; qo‘lda chiqishda unutiladi', () => {
    let state = authReducer(authReducer(undefined, authenticated({ accessToken: 'token' })), unknownRoleSeen('U-2087'));
    state = authReducer(state, loggedOut());
    state = authReducer(authReducer(state, authenticated({ accessToken: 'new' })), currentUserLoaded(laylo));
    expect(state.roleChange).toEqual({ before: null, after: 'OPERATOR_LEAD' });

    state = authReducer(authReducer(start(), loggedOut({ manual: true })), authenticated({ accessToken: 'new' }));
    state = authReducer(state, currentUserLoaded({ ...laylo, role: 'SUPERVISOR' }));
    expect(state.roleChange).toBeNull();
  });

  it('hisob yopildi: tokenlar o‘chadi, foydalanuvchi joyida (oyna), «Sessiya tugadi» o‘rniga; chiqishda tozalanadi', () => {
    let state = authReducer(start(), sessionExpired());
    state = authReducer(state, accountLocked(lock));
    expect(state).toMatchObject({ accessToken: null, cookieSession: false, sessionExpired: false, accountLock: lock, user: laylo });
    state = authReducer(state, loggedOut({ manual: true }));
    expect(state.accountLock).toBeNull();
    expect(authReducer(authReducer(start(), accountLocked(lock)), authenticated({ accessToken: 'x' })).accountLock).toBeNull();
  });
});
