import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button, Result, Typography } from 'antd';
import styles from './ErrorBoundary.module.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

const CHUNK_RELOAD_KEY = 'elchi_chunk_reload';
const CHUNK_RELOAD_COOLDOWN_MS = 30_000;

function isChunkLoadError(error: Error): boolean {
  return /ChunkLoadError|Loading chunk|dynamically imported module|module script/i.test(
    `${error.name} ${error.message}`,
  );
}

function reloadAfterChunkError(error: Error): boolean {
  if (!isChunkLoadError(error)) return false;

  try {
    const previousReload = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY));
    const now = Date.now();

    if (Number.isFinite(previousReload) && now - previousReload < CHUNK_RELOAD_COOLDOWN_MS) {
      return false;
    }

    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now));
    window.location.reload();
    return true;
  } catch {
    return false;
  }
}

/**
 * Render paytidagi kutilmagan xatoni ushlaydi. Busiz React butun daraxtni
 * o'chirib tashlaydi va foydalanuvchi bo'sh oq sahifa ko'radi — server javobi
 * kutilmagan formatda kelganda bu real ehtimol.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Konsol — brauzerdagi yagona diagnostika kanali; xatoni yutib yubormaymiz.
    console.error('Kutilmagan render xatosi:', error, info.componentStack);
    // Deploydan keyin ochiq tab eski hashli lazy chunkni so‘rashi mumkin.
    // Rad etilgan import cache'da qoladi, shu sabab yangi index va bundle bir
    // marta olinadi. Cooldown doimiy tarmoq xatosida reload siklini to‘xtatadi.
    reloadAfterChunkError(error);
  }

  private readonly handleReload = () => {
    window.location.reload();
  };

  private readonly handleRetry = () => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;

    if (!error) {
      return this.props.children;
    }

    return (
      <main className={styles.page}>
        <Result
        status="error"
        title="Nimadir noto‘g‘ri ketdi"
        subTitle="Sahifani ko‘rsatib bo‘lmadi. Qayta urinib ko‘ring — muammo takrorlansa, sahifani yangilang."
        extra={[
          <Button type="primary" key="retry" onClick={this.handleRetry}>
            Qayta urinish
          </Button>,
          <Button key="reload" onClick={this.handleReload}>
            Sahifani yangilash
          </Button>,
        ]}
      >
        {import.meta.env.DEV ? (
          <Typography.Paragraph type="secondary" copyable={{ text: error.stack }}>
            <code>{error.message}</code>
          </Typography.Paragraph>
        ) : null}
        </Result>
      </main>
    );
  }
}
