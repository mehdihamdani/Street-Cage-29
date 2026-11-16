import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'حدث خطأ غير متوقع في التطبيق.',
    };
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="w-screen h-screen bg-[#080c14] flex items-center justify-center p-6 text-center">
          <div className="max-w-md rounded-2xl bg-[#0f1624] border border-white/12 p-6 shadow-2xl">
            <h2 className="font-display text-xl font-bold text-white mb-2">
              تعذر تحميل الواجهة
            </h2>
            <p className="text-sm text-slate-300 mb-4">
              حدث خلل مؤقت أثناء الاتصال بقاعدة البيانات أو عرض الصفحة.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm cursor-pointer"
            >
              إعادة تحميل اللعبة
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
