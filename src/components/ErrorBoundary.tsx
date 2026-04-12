import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      const isQuotaError = this.state.error?.message.includes('Quota limit exceeded') || 
                          this.state.error?.message.includes('Quota exceeded');
      
      return (
        <div className="min-h-screen bg-[#F6F4F8] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center border border-black/5">
            <div className={`w-20 h-20 ${isQuotaError ? 'bg-amber-50' : 'bg-red-50'} rounded-full flex items-center justify-center mx-auto mb-6`}>
              <AlertCircle className={`w-10 h-10 ${isQuotaError ? 'text-amber-500' : 'text-red-500'}`} />
            </div>
            
            <h1 className="text-2xl font-bold text-heading mb-4">
              {isQuotaError ? 'Günlük Limit Aşıldı' : 'Bir Şeyler Yanlış Gitti'}
            </h1>
            
            <p className="text-body mb-8">
              {isQuotaError 
                ? 'Uygulamamızın ücretsiz kullanım kotası bugünlük dolmuştur. Yarın tekrar bekleriz veya daha sonra tekrar deneyebilirsiniz. Anlayışınız için teşekkürler! ✨'
                : 'Beklenmedik bir hata oluştu. Lütfen sayfayı yenilemeyi veya ana sayfaya dönmeyi deneyin.'}
            </p>

            {this.state.error && (
              <div className="mb-8 p-4 bg-black/5 rounded-xl text-left overflow-auto max-h-40">
                <code className="text-[10px] text-muted font-mono">
                  {this.state.error.message}
                </code>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={this.handleReset}
                className="flex items-center justify-center gap-2 py-4 bg-primary text-white rounded-2xl font-semibold hover:opacity-90 transition-all active:scale-95"
              >
                <RefreshCw className="w-5 h-5" />
                Yenile
              </button>
              
              <button
                onClick={this.handleGoHome}
                className="flex items-center justify-center gap-2 py-4 bg-black/5 text-heading rounded-2xl font-semibold hover:bg-black/10 transition-all active:scale-95"
              >
                <Home className="w-5 h-5" />
                Ana Sayfa
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
