'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';

function VerifyContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Липсва линк за потвърждение.');
      return;
    }

    fetch('/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setStatus('success');
          setMessage('Сигналът беше успешно потвърден.');
        } else {
          setStatus('error');
          setMessage(data.error || 'Невалиден или изтекъл линк.');
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('Грешка при потвърждение. Опитайте отново.');
      });
  }, [token]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-100">
      <div className="rounded-2xl bg-white border border-slate-200 shadow-xl max-w-md w-full p-6 text-center">
        {status === 'loading' && (
          <p className="text-slate-600">Потвърждаване...</p>
        )}
        {status === 'success' && (
          <>
            <p className="text-lg text-slate-900">{message}</p>
            <Link
              href="/"
              className="mt-4 inline-block px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition-smooth"
            >
              Към картата
            </Link>
          </>
        )}
        {status === 'error' && (
          <>
            <p className="text-lg text-red-600">{message}</p>
            <Link
              href="/"
              className="mt-4 inline-block px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition-smooth"
            >
              Към началната страница
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <p className="text-slate-600">Зареждане...</p>
      </div>
    }>
      <VerifyContent />
    </Suspense>
  );
}
