import * as React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      let errorMessage = '알 수 없는 오류가 발생했습니다.';
      
      try {
        // Check if the error is a FirestoreErrorInfo JSON string
        const errorInfo = JSON.parse(this.state.error?.message || '');
        if (errorInfo.error) {
          if (errorInfo.error.includes('Missing or insufficient permissions')) {
            errorMessage = '데이터를 처리할 권한이 없습니다. 관리자에게 문의하세요.';
          } else if (errorInfo.error.includes('the client is offline')) {
            errorMessage = '네트워크 연결이 원활하지 않습니다.';
          } else {
            errorMessage = errorInfo.error;
          }
        }
      } catch {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-6">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl text-center border border-orange-100">
            <div className="w-20 h-20 bg-orange-50 text-[#E86A33] rounded-3xl flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-black mb-4 text-[#483729]">오류가 발생했습니다</h2>
            <p className="text-gray-500 mb-8 font-medium leading-relaxed">
              {errorMessage}
            </p>
            <button
              onClick={this.handleReset}
              className="w-full py-4 bg-[#E86A33] text-white font-black rounded-2xl shadow-lg shadow-orange-200 flex items-center justify-center gap-2 hover:bg-[#d45a2a] transition-all"
            >
              <RefreshCw className="w-5 h-5" />
              다시 시도하기
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
