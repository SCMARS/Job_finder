import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error | null;
}

class ErrorBoundary extends React.Component<React.PropsWithChildren<{}>, ErrorBoundaryState> {
  constructor(props: {}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('Frontend crashed with error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="container">
          <div className="card" style={{ marginTop: '24px' }}>
            <div className="card-header">
              <h3 className="card-title">❌ Произошла ошибка в интерфейсе</h3>
            </div>
            <p className="text-muted" style={{ marginTop: 8 }}>Страница не будет закрыта. Попробуйте обновить вкладку или вернуться на Dashboard.</p>
            <button className="btn" onClick={() => window.location.reload()}>Перезагрузить</button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary; 