import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DollarSign, ShoppingCart, Package, Users as UsersIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/context/AuthContext';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
// Recharts moved to lazy-loaded chart component for code-splitting
// import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import React, { Suspense } from 'react';
const AdminSalesChart = React.lazy(() => import('./AdminSalesChart'));
// Lightweight inline component to upload CSV to bulk import endpoint
function BulkCsvUploader({ apiBase, headers, onDone }: { apiBase: string; headers: any; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const onUpload = async () => {
    if (!file) return;
    setBusy(true); setResult(null); setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${apiBase}/api/admin/products/bulk`, { method: 'POST', headers: { ...(headers||{}) }, body: form as any });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Upload failed');
      setResult(`Imported ${data.insertedCount || 0} product(s).`);
      setFile(null);
      onDone();
    } catch (e: any) {
      setError(e?.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
      <input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-sm" />
      <Button size="sm" onClick={onUpload} disabled={!file || busy}>{busy ? 'Uploading…' : 'Upload CSV'}</Button>
      {result && <span className="text-xs text-green-600">{result}</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}


type Summary = { users: number; products: number; orders: number; sales: number };
type SalesPoint = { date: string; sales: number };
type Analytics = {
  totalSales: number;
  salesToday: number;
  totalOrders: number;
  paidOrders: number;
  pendingPayments: number;
  salesLast30Days: SalesPoint[];
  topProducts: { product_id: number; title: string; revenue: number; qty: number }[];
};

export default function AdminPage() {
  const { token } = useAuth();
  const apiBase = import.meta.env.VITE_API_URL || 'https://thrift-production-af9f.up.railway.app';
  const [tab, setTab] = useState<'dashboard'|'orders'|'products'|'users'|'payments'>('dashboard');
  const [ledger, setLedger] = useState<any[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  // table UX state
  const [query, setQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const pageSize = 10;
  // Legacy seller verification removed; trust now derives from post-purchase feedback.
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [salesRange, setSalesRange] = useState<number>(30); // days: 7,30,90
  const [recentOrders, setRecentOrders] = useState<any[]>([]);

  const headers = token ? { Authorization: `Bearer ${token}` } : undefined as any;

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/api/admin/summary`, { headers });
        if (!res.ok) return;
        const data = await res.json();
        if (mounted) setSummary(data);
      } catch {}
    })();
    return () => { mounted = false; };
  }, [apiBase, token]);

  const loadAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      // Simple sessionStorage cache (2 min TTL)
      const key = `admin_sales_cache_v1_${salesRange}`;
      const cachedRaw = sessionStorage.getItem(key);
      setPage(1);
      if (cachedRaw) {
        try {
          const cached = JSON.parse(cachedRaw);
          if (cached && cached.ts && Date.now() - cached.ts < 2 * 60 * 1000) {
            setAnalytics(cached.data);
            setAnalyticsLoading(false);
            return;
          }
      setPage(1);
        } catch {}
      }
      const res = await fetch(`${apiBase}/api/admin/analytics/sales?range=${salesRange}`, { headers });
      if (!res.ok) return;
      const data: Analytics = await res.json();
      setAnalytics(data);
      try { sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch {}
    } finally {
      setPage(1);
      setAnalyticsLoading(false);
    }
  };

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/admin/orders`, { headers });
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
      // Refresh ledger so per-order payment snapshot is available
      try { await loadLedger(); } catch {}
    } finally { setLoading(false); }
  };
  const loadRecentOrders = async () => {
    try {
      const res = await fetch(`${apiBase}/api/admin/orders`, { headers });
      const data = await res.json();
      const list = Array.isArray(data) ? data.slice(0, 5) : [];
      setRecentOrders(list);
    } catch {}
  };
  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/admin/products`, { headers });
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } finally { setLoading(false); }
  };
  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/admin/users`, { headers });
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } finally { setLoading(false); }
  };

  const loadLedger = async () => {
    setLedgerLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/payments/ledger`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      setLedger(Array.isArray(data) ? data : []);
    } finally { setLedgerLoading(false); }
  };

  useEffect(() => {
    if (tab === 'orders') loadOrders();
    if (tab === 'products') loadProducts();
    if (tab === 'users') loadUsers();
    if (tab === 'dashboard') { loadAnalytics(); loadRecentOrders(); }
    if (tab === 'payments') loadLedger();
  // verification tab removed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const chartConfig = useMemo(() => ({
    sales: {
      label: 'Sales',
      color: 'hsl(var(--thrift-green))',
    },
  }), []);

  const updateOrder = async (id: number, patch: any) => {
    await fetch(`${apiBase}/api/admin/orders/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(headers||{}) }, body: JSON.stringify(patch) });
    await loadOrders();
  };
  const updateProduct = async (id: number, patch: any) => {
    await fetch(`${apiBase}/api/admin/products/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(headers||{}) }, body: JSON.stringify(patch) });
    await loadProducts();
  };
  const deleteProduct = async (id: number) => {
    await fetch(`${apiBase}/api/admin/products/${id}`, { method: 'DELETE', headers });
    await loadProducts();
  };
  const updateUser = async (id: number, patch: any) => {
    await fetch(`${apiBase}/api/admin/users/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(headers||{}) }, body: JSON.stringify(patch) });
    await loadUsers();
  };

  // remove legacy verification handlers

  // helpers: filtering + pagination
  const normalize = (v: any) => (v == null ? '' : String(v).toLowerCase());
  const paginate = <T,>(arr: T[]) => {
    const start = (page - 1) * pageSize;
    return arr.slice(start, start + pageSize);
  };

  // derive display rows per tab
  const filteredOrders = useMemo(() => {
    const q = normalize(query);
    const rows = orders.map(o => {
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
        normalize(o.user_id).includes(q) ||
        normalize(o._phone).includes(q) ||
        normalize(o._address).includes(q) ||
        normalize(o.status).includes(q) ||
        normalize(o.payment_status).includes(q) ||
        normalize(o.payment_method).includes(q)
      );
    });
    return rows;
  }, [orders, query]);

  const filteredProducts = useMemo(() => {
    const q = normalize(query);
    return products.filter(p => {
      if (!q) return true;
      return (
        normalize(p.title).includes(q) ||
        normalize(p.brand).includes(q) ||
        normalize(p.category).includes(q) ||
        normalize(p.status).includes(q)
      );
    });
  }, [products, query]);

  const filteredUsers = useMemo(() => {
    const q = normalize(query);
    return users.filter(u => {
      if (!q) return true;
      return (
        normalize(u.name).includes(q) ||
        normalize(u.email).includes(q) ||
        normalize(u.role).includes(q)
      );
    });
  }, [users, query]);

  return (
    <div className="container mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-6">Admin</h1>
      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
        <aside className="border rounded bg-card h-fit">
          <nav className="flex md:flex-col">
            <button className={`text-left px-4 py-3 w-full border-b md:border-b-0 hover:bg-[hsl(var(--thrift-green))]/10 ${tab==='dashboard' ? 'bg-[hsl(var(--thrift-green))]/10 text-[hsl(var(--thrift-green))] font-medium' : ''}`} onClick={() => setTab('dashboard')}>Dashboard</button>
            <button className={`text-left px-4 py-3 w-full border-b md:border-b-0 hover:bg-[hsl(var(--thrift-green))]/10 ${tab==='orders' ? 'bg-[hsl(var(--thrift-green))]/10 text-[hsl(var(--thrift-green))] font-medium' : ''}`} onClick={() => setTab('orders')}>Orders</button>
            <button className={`text-left px-4 py-3 w-full border-b md:border-b-0 hover:bg-[hsl(var(--thrift-green))]/10 ${tab==='products' ? 'bg-[hsl(var(--thrift-green))]/10 text-[hsl(var(--thrift-green))] font-medium' : ''}`} onClick={() => setTab('products')}>Products</button>
            <button className={`text-left px-4 py-3 w-full hover:bg-[hsl(var(--thrift-green))]/10 ${tab==='users' ? 'bg-[hsl(var(--thrift-green))]/10 text-[hsl(var(--thrift-green))] font-medium' : ''}`} onClick={() => setTab('users')}>Users</button>
            <button className={`text-left px-4 py-3 w-full hover:bg-[hsl(var(--thrift-green))]/10 ${tab==='payments' ? 'bg-[hsl(var(--thrift-green))]/10 text-[hsl(var(--thrift-green))] font-medium' : ''}`} onClick={() => setTab('payments')}>Payments</button>
            {/* Seller Verification tab removed */}
          </nav>
        </aside>
        <div className="space-y-6">
          {tab === 'dashboard' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-none shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle>Total Sales</CardTitle>
                    <div className="h-8 w-8 rounded-full bg-thrift-green/10 flex items-center justify-center"><DollarSign className="h-4 w-4 text-thrift-green" /></div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{summary?.sales != null ? `₨ ${Number(summary.sales).toLocaleString()}` : '—'}</div>
                    <div className="text-xs text-muted-foreground mt-1">+12% from last month</div>
                  </CardContent>
                </Card>
                <Card className="border-none shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle>Total Orders</CardTitle>
                    <div className="h-8 w-8 rounded-full bg-thrift-green/10 flex items-center justify-center"><ShoppingCart className="h-4 w-4 text-thrift-green" /></div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{summary?.orders ?? '—'}</div>
                    <div className="text-xs text-muted-foreground mt-1">+8% from last month</div>
                  </CardContent>
                </Card>
                <Card className="border-none shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle>Total Products</CardTitle>
                    <div className="h-8 w-8 rounded-full bg-thrift-green/10 flex items-center justify-center"><Package className="h-4 w-4 text-thrift-green" /></div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{summary?.products ?? '—'}</div>
                    <div className="text-xs text-muted-foreground mt-1">+23% from last month</div>
                  </CardContent>
                </Card>
                <Card className="border-none shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle>Active Users</CardTitle>
                    <div className="h-8 w-8 rounded-full bg-thrift-green/10 flex items-center justify-center"><UsersIcon className="h-4 w-4 text-thrift-green" /></div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{summary?.users ?? '—'}</div>
                    <div className="text-xs text-muted-foreground mt-1">+18% from last month</div>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-none shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div className="flex items-center gap-4">
                    <CardTitle>Sales (Last {salesRange} days)</CardTitle>
                    <select
                      className="border rounded px-2 py-1 text-sm"
                      value={salesRange}
                      onChange={(e) => { setSalesRange(Number(e.target.value)); setTimeout(loadAnalytics, 0); }}
                    >
                      <option value={7}>7d</option>
                      <option value={30}>30d</option>
                      <option value={90}>90d</option>
                    </select>
                  </div>
                  <Button variant="ghost" onClick={loadAnalytics}>{analyticsLoading ? 'Loading...' : 'Refresh'}</Button>
                </CardHeader>
                <CardContent>
                  {analytics?.salesLast30Days && analytics.salesLast30Days.length > 0 ? (
                    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading chart…</div>}>
                      <AdminSalesChart data={analytics.salesLast30Days} />
                    </Suspense>
                  ) : (
                    <div className="text-sm text-muted-foreground">No sales data yet.</div>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="border-none shadow-sm lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Recent Orders</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="w-full overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="text-left text-muted-foreground">
                          <tr className="border-b">
                            <th className="py-2 pr-4">Order ID</th>
                            <th className="py-2 pr-4">Customer</th>
                            <th className="py-2 pr-4">Total</th>
                            <th className="py-2 pr-4">Status</th>
                            <th className="py-2 pr-0">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(recentOrders || []).map(o => (
                            <tr key={o.id} className="border-b">
                              <td className="py-2 pr-4 font-medium">#ORD-{o.id}</td>
                              <td className="py-2 pr-4">{o.user_id ?? '—'}</td>
                              <td className="py-2 pr-4">₨ {Number(o.total||0).toLocaleString()}</td>
                              <td className="py-2 pr-4">
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${String(o.status)==='sold' ? 'bg-green-100 text-green-700' : String(o.status)==='cancelled' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{String(o.status||'pending')}</span>
                              </td>
                              <td className="py-2 pr-0">{new Date(o.created_at).toLocaleDateString()}</td>
                            </tr>
                          ))}
                          {recentOrders.length === 0 && (
                            <tr><td className="py-3 text-muted-foreground" colSpan={5}>No recent orders.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-none shadow-sm">
                  <CardHeader>
                    <CardTitle>Top Products</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(analytics?.topProducts || []).slice(0,5).map((tp, idx, arr) => {
                      const max = Math.max(...arr.map(a => a.revenue || 0), 1);
                      const pct = Math.round(((tp.revenue || 0) / max) * 100);
                      return (
                        <div key={tp.product_id} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <div className="font-medium truncate pr-2" title={tp.title}>{tp.title}</div>
                            <div className="text-muted-foreground text-xs">₨ {Number(tp.revenue||0).toLocaleString()}</div>
                          </div>
                          <div className="h-2 w-full bg-muted rounded">
                            <div className="h-2 bg-thrift-green rounded" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="text-[10px] text-muted-foreground">{tp.qty} sold</div>
                        </div>
                      );
                    })}
                    {(!analytics?.topProducts || analytics.topProducts.length === 0) && (
                      <div className="text-sm text-muted-foreground">No top product data.</div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {tab === 'orders' && (
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
                        <th className="py-2 pr-4">Customer</th>
                        <th className="py-2 pr-4">Phone</th>
                        <th className="py-2 pr-4">Address</th>
                        <th className="py-2 pr-4">Total</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2 pr-4">Payment Method</th>
                        <th className="py-2 pr-4">Payment Status</th>
                        <th className="py-2 pr-0">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginate(filteredOrders).map(o => {
                        let phone = '';
                        let address = '';
                        try {
                          const sa = o.shipping_address ? (typeof o.shipping_address === 'string' ? JSON.parse(o.shipping_address) : o.shipping_address) : {};
                          phone = sa.phone || sa.contact || '';
                          address = sa.address || sa.addressLine || sa.street || '';
                        } catch {}
                        const related = ledger.filter(l => Number(l.order_id) === Number(o.id));
                        const latest = related[0];
                        return (
                          <tr key={o.id} className="border-b hover:bg-muted/30">
                            <td className="py-2 pr-4 font-medium">{o.id}</td>
                            <td className="py-2 pr-4">{o.user_id ?? '—'}</td>
                            <td className="py-2 pr-4">{phone || '—'}</td>
                            <td className="py-2 pr-4">{address || '—'}</td>
                            <td className="py-2 pr-4">NPR {Number(o.total||0).toLocaleString()}</td>
                            <td className="py-2 pr-4">
                              <select className="border rounded px-2 py-1 text-xs" value={String(o.status||'pending')} onChange={(e) => updateOrder(o.id, { status: e.target.value })}>
                                <option value="pending">pending</option>
                                <option value="cancelled">cancelled</option>
                                <option value="sold">sold</option>
                              </select>
                            </td>
                            <td className="py-2 pr-4">{o.payment_method || '—'}</td>
                            <td className="py-2 pr-4">
                              <select className="border rounded px-2 py-1 text-xs" value={String(o.payment_status||'pending')} onChange={(e) => updateOrder(o.id, { payment_status: e.target.value })}>
                                <option value="pending">pending</option>
                                <option value="paid">paid</option>
                                <option value="refunded">refunded</option>
                              </select>
                            </td>
                            <td className="py-2 pr-0">
                              <div className="flex items-center gap-2 text-xs">
                                {String(o.status) !== 'cancelled' && (
                                  <Button variant="ghost" size="sm" onClick={() => updateOrder(o.id, { status: 'cancelled' })}>Cancel</Button>
                                )}
                                {latest ? (
                                  <Badge variant="secondary" className="whitespace-nowrap">{latest.method}{latest.gateway_txn_id ? ` • ${latest.gateway_txn_id}` : ''}</Badge>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div>Showing {paginate(filteredOrders).length} of {filteredOrders.length} orders</div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={page<=1} onClick={() => setPage(p => Math.max(1, p-1))}>Previous</Button>
                    <div>Page {page} of {Math.max(1, Math.ceil(filteredOrders.length / pageSize))}</div>
                    <Button variant="outline" size="sm" disabled={page>=Math.ceil(filteredOrders.length/pageSize)} onClick={() => setPage(p => p+1)}>Next</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {tab === 'products' && (
            <Card className="border-none shadow-sm">
              <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                  <CardTitle>Products</CardTitle>
                  <Button variant="ghost" onClick={loadProducts}>{loading ? 'Loading...' : 'Refresh'}</Button>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <Input placeholder="Search..." value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} />
                  <Button variant="outline" type="button">Filter</Button>
                  {/* Bulk CSV upload */}
                  <BulkCsvUploader apiBase={apiBase} headers={headers} onDone={loadProducts} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-muted-foreground">
                      <tr className="border-b">
                        <th className="py-2 pr-4">Product ID</th>
                        <th className="py-2 pr-4">Name</th>
                        <th className="py-2 pr-4">Category</th>
                        <th className="py-2 pr-4">Price</th>
                        <th className="py-2 pr-4">Brand</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2 pr-0">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginate(filteredProducts).map(p => (
                        <tr key={p.id} className="border-b hover:bg-muted/30">
                          <td className="py-2 pr-4 font-medium">{p.id}</td>
                          <td className="py-2 pr-4">
                            <div className="flex items-center gap-2">
                              {(p.images?.[0] || p.image) && <img src={p.images?.[0] || p.image} alt={p.title} className="w-8 h-8 object-cover rounded" />}
                              <span>{p.title}</span>
                            </div>
                          </td>
                          <td className="py-2 pr-4">{p.category || '—'}</td>
                          <td className="py-2 pr-4">NPR {Number(p.price||0).toLocaleString()}</td>
                          <td className="py-2 pr-4">{p.brand || '—'}</td>
                          <td className="py-2 pr-4">
                            <select className="border rounded px-2 py-1 text-xs" value={String(p.status||'unsold')} onChange={(e) => updateProduct(p.id, { status: e.target.value })}>
                              <option value="unsold">unsold</option>
                              <option value="order_received">order_received</option>
                              <option value="sold">sold</option>
                            </select>
                          </td>
                          <td className="py-2 pr-0">
                            <div className="flex items-center gap-2">
                              <Button variant="destructive" size="sm" onClick={() => deleteProduct(p.id)}>Delete</Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div>Showing {paginate(filteredProducts).length} of {filteredProducts.length} products</div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={page<=1} onClick={() => setPage(p => Math.max(1, p-1))}>Previous</Button>
                    <div>Page {page} of {Math.max(1, Math.ceil(filteredProducts.length / pageSize))}</div>
                    <Button variant="outline" size="sm" disabled={page>=Math.ceil(filteredProducts.length/pageSize)} onClick={() => setPage(p => p+1)}>Next</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {tab === 'users' && (
            <Card className="border-none shadow-sm">
              <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <CardTitle>Users</CardTitle>
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <Input placeholder="Search..." value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} />
                  <Button variant="outline" type="button">Filter</Button>
                  <Button variant="ghost" onClick={loadUsers}>{loading ? 'Loading...' : 'Refresh'}</Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-muted-foreground">
                      <tr className="border-b">
                        <th className="py-2 pr-4">ID</th>
                        <th className="py-2 pr-4">Username</th>
                        <th className="py-2 pr-4">Email</th>
                        <th className="py-2 pr-4">Role</th>
                        <th className="py-2 pr-0">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginate(filteredUsers).map(u => (
                        <tr key={u.id} className="border-b hover:bg-muted/30">
                          <td className="py-2 pr-4 font-medium">{u.id}</td>
                          <td className="py-2 pr-4">{u.name || '—'}</td>
                          <td className="py-2 pr-4">{u.email}</td>
                          <td className="py-2 pr-4">
                            <Badge variant="secondary" className="capitalize">{String(u.role||'user')}</Badge>
                          </td>
                          <td className="py-2 pr-0">
                            <select className="border rounded px-2 py-1 text-xs" value={String(u.role||'user')} onChange={(e) => updateUser(u.id, { role: e.target.value })}>
                              <option value="user">user</option>
                              <option value="admin">admin</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div>Showing {paginate(filteredUsers).length} of {filteredUsers.length} users</div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={page<=1} onClick={() => setPage(p => Math.max(1, p-1))}>Previous</Button>
                    <div>Page {page} of {Math.max(1, Math.ceil(filteredUsers.length / pageSize))}</div>
                    <Button variant="outline" size="sm" disabled={page>=Math.ceil(filteredUsers.length/pageSize)} onClick={() => setPage(p => p+1)}>Next</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {tab === 'payments' && (
            <Card className="border-none shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between"><CardTitle>Payment Ledger</CardTitle><Button variant="ghost" onClick={loadLedger}>{ledgerLoading ? 'Loading...' : 'Refresh'}</Button></CardHeader>
              <CardContent>
                {ledger.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No ledger entries yet.</div>
                ) : (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {ledger.map(entry => (
                      <Card key={entry.id} className="border rounded shadow-sm">
                        <CardHeader className="py-3 pb-1">
                          <CardTitle className="text-sm font-medium flex items-center justify-between">
                            <span>#{entry.id} • {entry.method}</span>
                            <span className={`text-xs ${entry.status === 'verified' ? 'text-green-600' : 'text-yellow-600'}`}>{entry.status}</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs space-y-1">
                          <div>Order: {entry.order_id || '—'}</div>
                          <div>Txn: {entry.gateway_txn_id || '—'}</div>
                          <div>Amount: {entry.amount != null ? Number(entry.amount).toLocaleString() : '—'} {entry.currency}</div>
                          <div className="text-muted-foreground">{new Date(entry.created_at).toLocaleString()}</div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          {/* Verification panel removed */}
        </div>
      </div>
    </div>
  );
}
