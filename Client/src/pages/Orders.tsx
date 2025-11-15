import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export default function OrdersPage() {
  const { token } = useAuth();
  const apiBase = (import.meta as any).env?.VITE_API_URL || 'https://thrift-production-af9f.up.railway.app';
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined as any;
  const navigate = useNavigate();

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/orders/mine`, { headers });
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
      setPage(1);
    } finally {
      setLoading(false);
    }
  };

  const cancelOrder = async (id: number) => {
    try {
      await fetch(`${apiBase}/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(headers || {}) },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      await loadOrders();
    } catch {}
  };

  useEffect(() => { loadOrders(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const normalize = (v: any) => (v == null ? '' : String(v).toLowerCase());

  const filtered = useMemo(() => {
    const q = normalize(query);
    return orders.map(o => {
      let phone = '';
      let address = '';
      try {
        const sa = o.shipping_address ? (typeof o.shipping_address === 'string' ? JSON.parse(o.shipping_address) : o.shipping_address) : {};
        phone = sa.phone || sa.contact || '';
        address = sa.address || sa.addressLine || sa.street || '';
      } catch {}
      return { ...o, _phone: phone, _address: address };
    }).filter(o => {
      if (!q) return true;
      return (
        normalize(o.id).includes(q) ||
        normalize(o.payment_method).includes(q) ||
        normalize(o.payment_status).includes(q) ||
        normalize(o.status).includes(q) ||
        normalize(o._phone).includes(q) ||
        normalize(o._address).includes(q)
      );
    });
  }, [orders, query]);

  const paginate = <T,>(arr: T[]) => arr.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2 text-[hsl(var(--thrift-green))]">My Orders</h1>
      </div>
      <Card className="border-none shadow-sm">
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle>Orders</CardTitle>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Input placeholder="Search..." value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} />
            <Button variant="outline" type="button">Filter</Button>
            <Button variant="ghost" onClick={loadOrders}>{loading ? 'Loading...' : 'Refresh'}</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="w-full overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pr-4">Order ID</th>
                  <th className="py-2 pr-4">Items</th>
                  <th className="py-2 pr-4">Total</th>
                  <th className="py-2 pr-4">Payment</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-0">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginate(filtered).map(o => (
                  <tr key={o.id} className="border-b hover:bg-muted/30">
                    <td className="py-2 pr-4 font-medium">#{o.id}</td>
                    <td className="py-2 pr-4">{(o.items || []).length}</td>
                    <td className="py-2 pr-4">₨ {Number(o.total || 0).toLocaleString()}</td>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        <span>{o.payment_method || '—'}</span>
                        <Badge variant="secondary" className="capitalize">{String(o.payment_status || 'pending')}</Badge>
                      </div>
                    </td>
                    <td className="py-2 pr-4">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${String(o.status)==='sold' ? 'bg-green-100 text-green-700' : String(o.status)==='cancelled' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{String(o.status||'pending')}</span>
                    </td>
                    <td className="py-2 pr-4">{new Date(o.created_at).toLocaleDateString()}</td>
                    <td className="py-2 pr-0">
                      <div className="flex items-center gap-2">
                        <Button variant="secondary" size="sm" onClick={() => navigate(`/order/${o.id}`)}>View</Button>
                        {String(o.status) !== 'cancelled' && (
                          <Button variant="ghost" size="sm" onClick={() => cancelOrder(o.id)}>Cancel</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td className="py-3 text-muted-foreground" colSpan={7}>No orders yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div>Showing {paginate(filtered).length} of {filtered.length} orders</div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page<=1} onClick={() => setPage(p => Math.max(1, p-1))}>Previous</Button>
              <div>Page {page} of {Math.max(1, Math.ceil(filtered.length / pageSize))}</div>
              <Button variant="outline" size="sm" disabled={page>=Math.ceil(filtered.length/pageSize)} onClick={() => setPage(p => p+1)}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
