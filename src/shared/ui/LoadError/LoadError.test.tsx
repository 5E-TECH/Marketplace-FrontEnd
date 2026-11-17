import { act, fireEvent, render, screen } from '@testing-library/react';
import { App } from 'antd';
import { AxiosError, AxiosHeaders } from 'axios';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { store } from '../../../app/store/store';
import { LoadError } from './LoadError';

function httpError(status: number, data: unknown, headers: Record<string, string> = {}) {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('xato', 'ERR_BAD_RESPONSE', config, null, { status, statusText: '', data, headers, config });
}

const renderError = (error: unknown, onRetry = vi.fn()) => {
  render(<Provider store={store}><App><LoadError error={error} onRetry={onRetry} lastSuccessAt={Date.UTC(2027, 0, 14, 9, 31)} /></App></Provider>);
  return onRetry;
};

describe('LoadError (umumiy-xato-yuklanish)', () => {
  afterEach(() => vi.useRealTimers());

  it('xato raqami, oxirgi yangilanish va 60 soniyada o‘zi qayta urinish', () => {
    vi.useFakeTimers();
    const onRetry = renderError(httpError(500, { requestId: 'req-7f3a' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Ma’lumotni yuklab bo‘lmadi');
    expect(screen.getByText(/Xato raqami: req-7f3a/)).toBeInTheDocument();
    expect(screen.getByText(/oxirgi muvaffaqiyatli yangilanish: 14:31/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Qayta urinish' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('429 — kutish sanog‘i tugaguncha tugma o‘chiq', () => {
    vi.useFakeTimers();
    renderError(httpError(429, {}, { 'retry-after': '3' }));
    expect(screen.getByRole('alert')).toHaveTextContent('So‘rovlar juda tez yuborildi');
    expect(screen.getByRole('button', { name: 'Qayta urinish · 3' })).toBeDisabled();
    act(() => { vi.advanceTimersByTime(3_000); });
    expect(screen.getByRole('button', { name: 'Qayta urinish' })).toBeEnabled();
  });
});
