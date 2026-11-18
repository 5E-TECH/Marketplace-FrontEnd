import { useMutation } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { getApiErrorMessage } from '../../../shared/api/apiError';
import { readOtpFailure, sendOtp, type OtpFailure, type OtpPurpose } from '../api/sellerAuthApi';

const CODE_TTL_MS = 5 * 60_000;
const BLOCK_MS = 15 * 60_000;

/** Forma ustidagi/ostidagi blok (umumiy-kirish §1, sotuvchi-royxat §1–2). */
export type OtpNotice =
  | { kind: 'exists'; phone: string }
  | { kind: 'notFound' }
  | { kind: 'sendFailed' }
  | { kind: 'resent' }
  | { kind: 'error'; message: string };

export type OtpCodeError = { kind: 'invalid'; attemptsLeft: number } | { kind: 'expired' };

export interface OtpFlowState {
  /** `phone` — raqam kiritiladi; `code` — kod yuborildi; `blocked` — 3 xato, 15 daqiqa. */
  phase: 'phone' | 'code' | 'blocked';
  /** Mahalliy 9 xonali raqam (`+998` siz). */
  phone: string;
  expiresAt: number | null;
  /** SMS provayder javob bermadi — kod yo'qolmaydi, server o'zi qayta yuboradi. */
  delayed: boolean;
  blockedUntil: number | null;
  notice: OtpNotice | null;
  /** Server raqamni operatorga tegishli emas dedi (mijoz tekshiruvidan o'tib ketgan holat). */
  phoneError: 'operator' | null;
  codeError: OtpCodeError | null;
}

const INITIAL: OtpFlowState = {
  phase: 'phone',
  phone: '',
  expiresAt: null,
  delayed: false,
  blockedUntil: null,
  notice: null,
  phoneError: null,
  codeError: null,
};

/** Server bergan soniyalar → shu brauzer soatidagi tugash vaqti. */
const deadline = (seconds: number, fallbackMs: number) => Date.now() + (Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : fallbackMs);

interface RequestOptions {
  /** Shu raqamga kod qayta yuborilmoqda: «Yangi kod yuborildi» bloki chiqadi. */
  resend?: boolean;
  /** Xato holatni sahifaga yozmaydi — chaqiruvchi o'zi ko'rsatadi (raqamni o'zgartirish oynasi). */
  quiet?: boolean;
}

/**
 * SMS kod oqimi (SOT-1): raqam → kod (5 daqiqa) → tasdiq; 3 xato — 15 daqiqa blok.
 * Kodni tekshirish sahifaga bog'liq (ro'yxat tokeni yoki sessiya), shuning uchun
 * `handleVerifyError` alohida: sahifa o'z so'rovining xatosini shu yerga beradi.
 */
export function useOtpFlow(purpose: OtpPurpose) {
  const [state, setState] = useState<OtpFlowState>(INITIAL);
  const send = useMutation({ mutationFn: (phone: string) => sendOtp(`+998${phone}`, purpose) });
  const { mutateAsync } = send;

  const block = useCallback((phone: string, blockedUntil: number) => {
    setState((current) => ({ ...current, phase: 'blocked', phone, blockedUntil, notice: null, codeError: null, phoneError: null }));
  }, []);

  const requestCode = useCallback(
    async (phone: string, options: RequestOptions = {}): Promise<OtpFailure | null> => {
      setState((current) => ({ ...current, notice: null, phoneError: null }));
      try {
        const sent = await mutateAsync(phone);
        setState({
          ...INITIAL,
          phase: 'code',
          phone,
          expiresAt: deadline(sent.expiresIn, CODE_TTL_MS),
          delayed: sent.delivery === 'DELAYED',
          notice: options.resend ? { kind: 'resent' } : null,
        });
        return null;
      } catch (error) {
        const failure = readOtpFailure(error);
        if (failure.kind === 'blocked') {
          block(phone, deadline(failure.retryAfter, BLOCK_MS));
          return failure;
        }
        if (options.quiet) return failure;
        setState((current) => {
          // Raqam bosqichida xato — kiritilgan raqam saqlanadi («Raqam saqlandi — qayta urinib ko‘ring»).
          const base = current.phase === 'blocked' ? { ...current, phase: 'phone' as const } : current;
          const next = { ...base, phone };
          switch (failure.kind) {
            case 'alreadyRegistered':
              return { ...next, notice: { kind: 'exists', phone } };
            case 'notFound':
              return { ...next, notice: { kind: 'notFound' } };
            case 'operator':
              return { ...next, phoneError: 'operator' };
            case 'network':
              return { ...next, notice: { kind: 'sendFailed' } };
            default:
              return { ...next, notice: { kind: 'error', message: getApiErrorMessage(failure.kind === 'other' ? failure.error : null) } };
          }
        });
        return failure;
      }
    },
    [block, mutateAsync],
  );

  /** Kodni tekshirish so'rovi xato bilan tugadi. `true` — holat yangilandi. */
  const handleVerifyError = useCallback(
    (error: unknown): boolean => {
      const failure = readOtpFailure(error);
      switch (failure.kind) {
        case 'invalid':
          setState((current) => ({ ...current, notice: null, codeError: { kind: 'invalid', attemptsLeft: failure.attemptsLeft } }));
          return true;
        case 'expired':
          setState((current) => ({ ...current, notice: null, codeError: { kind: 'expired' } }));
          return true;
        case 'blocked':
          setState((current) => ({ ...current, phase: 'blocked', blockedUntil: deadline(failure.retryAfter, BLOCK_MS), notice: null, codeError: null, phoneError: null }));
          return true;
        case 'network':
          setState((current) => ({ ...current, notice: { kind: 'sendFailed' } }));
          return true;
        default:
          setState((current) => ({ ...current, notice: { kind: 'error', message: getApiErrorMessage(failure.kind === 'other' ? failure.error : null) } }));
          return true;
      }
    },
    [],
  );

  /** «O‘zgartirish» / «Boshqa raqam kiritish»: raqam bosqichiga qaytish. */
  const editPhone = useCallback(() => {
    setState((current) => ({ ...INITIAL, phone: current.phone }));
  }, []);

  /** Foydalanuvchi maydonni o'zgartirdi — eski xato matnlari yo'qoladi. */
  const clearErrors = useCallback(() => {
    setState((current) =>
      current.phoneError || current.codeError || (current.notice && current.notice.kind !== 'resent')
        ? { ...current, phoneError: null, codeError: current.codeError?.kind === 'expired' ? current.codeError : null, notice: current.notice?.kind === 'resent' ? current.notice : null }
        : current,
    );
  }, []);

  return { state, sending: send.isPending, requestCode, handleVerifyError, editPhone, clearErrors };
}
