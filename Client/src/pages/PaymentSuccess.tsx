import { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/context/AuthContext';

export default function PaymentSuccess() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const dataParam = params.get('data');
  const orderIdFromQuery = params.get('orderId');
  const [status, setStatus] = useState<'verifying' | 'ok' | 'fail'>('verifying');
  const [orderId, setOrderId] = useState<number | null>(null);
  const apiBase = import.meta.env.VITE_API_URL || 'https://thrift-production-af9f.up.railway.app';
  const { token } = useAuth();

  useEffect(() => {
    let active = true;
    async function verify() {
      if (orderIdFromQuery) {
        setOrderId(Number(orderIdFromQuery));
        setStatus('ok');
        // attempt to clear server cart
        try { if (token) { await fetch(`${apiBase.replace(/\/$/, '')}/api/cart`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); } } catch {}
        try { window.dispatchEvent(new CustomEvent('cartUpdated', { detail: { count: 0 } })); } catch {}
        try { window.dispatchEvent(new CustomEvent('orderPlaced', { detail: { id: Number(orderIdFromQuery) } })); } catch {}
        return;
      }
      if (!dataParam) { setStatus('ok'); return; }
      try {
        const res = await fetch(`${apiBase.replace(/\/$/, '')}/api/payments/esewa/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: dataParam }),
        });
        if (!res.ok) throw new Error('verify failed');
        const body = await res.json();
        if (!active) return;
        if (body.verified) {
          setOrderId(body.orderId ?? null);
          setStatus('ok');
          try { if (token) { await fetch(`${apiBase.replace(/\/$/, '')}/api/cart`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); } } catch {}
          try { window.dispatchEvent(new CustomEvent('cartUpdated', { detail: { count: 0 } })); } catch {}
          try { if (body.orderId) { window.dispatchEvent(new CustomEvent('orderPlaced', { detail: { id: body.orderId } })); } } catch {}
        } else {
          setStatus('fail');
        }
      } catch (e) {
        if (!active) return; setStatus('fail');
      }
    }
    verify();
    return () => { active = false; };
  }, [dataParam, apiBase, orderIdFromQuery]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Payment Success</CardTitle>
        </CardHeader>
        <CardContent>
          {status === 'verifying' && <p>Verifying payment…</p>}
          {status === 'ok' && (
            <div>
              <p className="mb-2">Your payment was completed successfully.</p>
              {orderId ? (
                <p>Order ID: <strong>{orderId}</strong></p>
              ) : (
                <p>Thank you for your purchase.</p>
              )}
              <div className="mt-4"><Link className="text-thrift-green underline" to="/">Go to Home</Link></div>
            </div>
          )}
          {status === 'fail' && (
            <div>
              <p className="mb-2 text-red-600">We could not verify your payment.</p>
              <div className="mt-4"><Link className="text-thrift-green underline" to="/">Return Home</Link></div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
