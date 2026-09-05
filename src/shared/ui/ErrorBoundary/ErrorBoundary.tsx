import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button, Result, Typography } from 'antd';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
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
    );
  }
}
