import { describe, expect, it } from 'vitest';
import { MOCK_OTP_CODE } from '../../../mocks/handlers/sellerAuth';
import { getLegalDocument, loginWithOtp, readOtpFailure, registerAffiliate, sendOtp, verifyRegisterOtp } from './sellerAuthApi';

const failure = (promise: Promise<unknown>) => promise.then(() => null, readOtpFailure);

describe('sotuvchi SMS kodi (SOT-1, BE-06 taklifi) — mock bilan', () => {
  it('TC2: 3 marta xato kod → 15 daqiqa blok, yangi kod ham berilmaydi', async () => {
    await sendOtp('+998971112233', 'REGISTER');
    await expect(failure(verifyRegisterOtp('+998971112233', '000000'))).resolves.toEqual({ kind: 'invalid', attemptsLeft: 2 });
    await expect(failure(verifyRegisterOtp('+998971112233', '000001'))).resolves.toEqual({ kind: 'invalid', attemptsLeft: 1 });
    const blocked = await failure(verifyRegisterOtp('+998971112233', '000002'));
    expect(blocked).toMatchObject({ kind: 'blocked' });
    const minutes = (blocked as { retryAfter: number }).retryAfter / 60;
    expect(minutes).toBeGreaterThan(14.9);
    expect(minutes).toBeLessThanOrEqual(15);
    await expect(failure(sendOtp('+998971112233', 'REGISTER'))).resolves.toMatchObject({ kind: 'blocked' });
  });

  it('TC1: ro‘yxat — kod → registrationToken → oferta va rozilik versiyasi bilan hisob', async () => {
    const sent = await sendOtp('+998971112244', 'REGISTER');
    expect(sent).toEqual({ expiresIn: 300, delivery: 'SENT' });
    const { registrationToken } = await verifyRegisterOtp('+998971112244', MOCK_OTP_CODE);
    await expect(registerAffiliate({ registrationToken, offerVersion: '', consentVersion: '1.0' })).rejects.toMatchObject({ response: { status: 400 } });
    const session = await registerAffiliate({ registrationToken, offerVersion: '1.0', consentVersion: '1.0' });
    expect(session.accessToken).toBe('mock.971112244');
    // Endi bu raqam ro'yxatda — qayta ro'yxat emas, kirish.
    await expect(failure(sendOtp('+998971112244', 'REGISTER'))).resolves.toEqual({ kind: 'alreadyRegistered' });
  });

  it('kirish: ro‘yxatda yo‘q yoki xodim raqami — «hisob topilmadi»; sotuvchi — sessiya', async () => {
    await expect(failure(sendOtp('+998971234567', 'LOGIN'))).resolves.toEqual({ kind: 'notFound' });
    await expect(failure(sendOtp('+998900000003', 'LOGIN'))).resolves.toEqual({ kind: 'notFound' });
    await sendOtp('+998900000001', 'LOGIN');
    await expect(loginWithOtp('+998900000001', MOCK_OTP_CODE)).resolves.toEqual({ accessToken: 'mock.900000001' });
  });

  it('operator kodi noto‘g‘ri raqam rad etiladi', async () => {
    await expect(failure(sendOtp('+998121234567', 'REGISTER'))).resolves.toEqual({ kind: 'operator' });
  });

  it('oferta hujjati — versiya, qisqacha shartlar va bo‘limlar', async () => {
    const offer = await getLegalDocument('affiliate-offer');
    expect(offer.version).toBe('1.0');
    expect(offer.summary).toHaveLength(4);
    expect(offer.sections).toHaveLength(9);
  });
});
