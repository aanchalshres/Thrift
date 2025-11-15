import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Mail, User as UserIcon, Phone, Key, Save, Edit3, Trash2, RefreshCw, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Profile() {
  const { user, token, login } = useAuth();
  const [searchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') || 'account') as 'account' | 'security' | 'orders';
  const [activeTab, setActiveTab] = useState<'account' | 'security' | 'orders'>(initialTab);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const initial = useMemo(
    () => ({
      name: user?.name ?? "",
      email: user?.email ?? "",
      phone: (user as any)?.phone ?? "",
    }),
    [user]
  );

  const [form, setForm] = useState(initial);

  useEffect(() => setForm(initial), [initial]);

  const apiBase = import.meta.env.VITE_API_URL || "https://thrift-production-af9f.up.railway.app";

  async function onSaveProfile() {
    if (!user?.id) return;
    setSaving(true);
    try {
      setMessage(null);
      const res = await fetch(`${apiBase}/api/users/me`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ id: user.id, name: form.name, phone: form.phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("Server error:", res.status, data);
        setMessage((data && (data.message || data.error)) || "Failed to update profile.");
        return;
      }
      const updated = data.user || { ...user, name: form.name, phone: form.phone };
      if (token) {
        login(token, updated as any);
      } else {
        localStorage.setItem("user", JSON.stringify(updated));
      }
      setEditing(false);
      setMessage("Profile updated.");
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setSaving(false);
    }
  }

  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });

  const onChangePassword = async () => {
    setMessage(null);
    if (!pwd.next || pwd.next.length < 6) {
      setMessage("New password must be at least 6 characters.");
      return;
    }
    if (pwd.next !== pwd.confirm) {
      setMessage("Passwords do not match.");
      return;
    }
    setPwdSaving(true);
    try {
      // Call backend if available
      await fetch(`${import.meta.env.VITE_API_URL || ""}/api/users/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ currentPassword: pwd.current, newPassword: pwd.next }),
      }).catch(() => {});
      setPwd({ current: "", next: "", confirm: "" });
      setMessage("Password updated.");
    } finally {
      setPwdSaving(false);
    }
  };

  const onDeleteAccount = async () => {
    // Optional: implement delete flow
    setMessage("Account deletion is not enabled in this demo.");
  };

  const [myOrders, setMyOrders] = useState<any[]>([]);
  const [loadingMy, setLoadingMy] = useState(false);
  const [hasLoadedMy, setHasLoadedMy] = useState(false);
  // table helpers
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const headers = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : undefined as any), [token]);
  const apiBaseMemo = import.meta.env.VITE_API_URL || "http://localhost:5000";

  const parseMaybeJson = (val: any) => {
    try {
      if (!val) return null;
      return typeof val === 'string' ? JSON.parse(val) : val;
    } catch {
      return null;
    }
  };

  const loadMy = useCallback(async () => {
    if (!token) return;
    setLoadingMy(true);
    const ac = new AbortController();
    try {
      const res = await fetch(`${apiBaseMemo}/api/orders/mine`, { headers, signal: ac.signal });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      const normalized = (Array.isArray(data) ? data : []).map((o: any) => ({
        ...o,
        items: parseMaybeJson(o.items) || [],
        shipping_address: parseMaybeJson(o.shipping_address) || o.shipping_address || o.shippingAddress || null,
      }));
      setMyOrders(normalized);
    } catch (e: any) {
      if (e?.name !== 'AbortError') setMyOrders([]);
    } finally { setLoadingMy(false); setHasLoadedMy(true); }
    return () => ac.abort();
  }, [apiBaseMemo, token, headers]);

  const cancelOrder = useCallback(async (id: number) => {
    try {
      await fetch(`${apiBaseMemo}/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(headers || {}) },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      await loadMy();
    } catch {}
  }, [apiBaseMemo, headers, loadMy]);


  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => { if (!cancelled) await loadMy(); })();
    return () => { cancelled = true; };
  }, [token, loadMy]);

  // React to order placements happening elsewhere in the app
  useEffect(() => {
    const onOrderPlaced = () => { loadMy(); };
    const onOrderUpdated = (e: any) => { loadMy(); };
    window.addEventListener('orderPlaced', onOrderPlaced as EventListener);
    window.addEventListener('orderUpdated', onOrderUpdated as EventListener);
    return () => {
      window.removeEventListener('orderPlaced', onOrderPlaced as EventListener);
      window.removeEventListener('orderUpdated', onOrderUpdated as EventListener);
    };
  }, [loadMy]);

  const navigate = useNavigate();

  // search + pagination helpers
  const normalize = (v: any) => (v == null ? '' : String(v).toLowerCase());
  const filteredOrders = useMemo(() => {
    const q = normalize(query);
    return myOrders.map(o => {
      let phone = '';
      let address = '';
      try {
        const sa = o.shipping_address || o.shippingAddress || null;
        if (sa) {
          phone = sa.phone || sa.contact || '';
          address = sa.address || sa.addressLine || sa.street || '';
        }
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
  }, [myOrders, query]);
  const paginate = <T,>(arr: T[]) => arr.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-16">
        <h1 className="text-2xl font-bold">My Profile</h1>
        <p className="text-muted-foreground mt-2">No user session found.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10">
      <h1 className="text-3xl text-[hsl(var(--thrift-green))]  font-bold mb-6">My Profile</h1>

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6">
        {/* Left navigation */}
        <aside className="border rounded bg-card h-fit">
          <nav className="flex md:flex-col">
            <button
              className={`text-left px-4 py-3 w-full border-b md:border-b-0 md:border-r-0 hover:bg-[hsl(var(--thrift-green))]/10 ${activeTab==='account' ? 'bg-[hsl(var(--thrift-green))]/10 text-[hsl(var(--thrift-green))] font-medium' : ''}`}
              onClick={() => setActiveTab('account')}
            >
              Profile Information
            </button>
            <button
              className={`text-left px-4 py-3 w-full border-b md:border-b-0 hover:bg-[hsl(var(--thrift-green))]/10 ${activeTab==='security' ? 'bg-[hsl(var(--thrift-green))]/10 text-[hsl(var(--thrift-green))] font-medium' : ''}`}
              onClick={() => setActiveTab('security')}
            >
              Password & Security
            </button>
            <button
              className={`text-left px-4 py-3 w-full hover:bg-[hsl(var(--thrift-green))]/10 ${activeTab==='orders' ? 'bg-[hsl(var(--thrift-green))]/10 text-[hsl(var(--thrift-green))] font-medium' : ''}`}
              onClick={() => setActiveTab('orders')}
            >
              My Orders
            </button>
          </nav>
        </aside>

  {/* Right content (narrower width, centered) */}
  <div className="space-y-6 max-w-2xl w-full mx-auto">
          {message && (
            <div className="text-sm text-thrift-green bg-thrift-green/10 border border-thrift-green/20 rounded p-3">
              {message}
            </div>
          )}

          {activeTab === 'account' && (
          <Card className="border-none shadow-sm bg-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Account Information</CardTitle>
              <div className="flex gap-2">
                {!editing ? (
                  <Button variant="outline" onClick={() => setEditing(true)}>
                    <Edit3 className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                ) : (
                  <Button onClick={onSaveProfile} disabled={saving}>
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? "Saving..." : "Save"}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground flex items-center gap-2 mb-1">
                  <UserIcon className="w-4 h-4" /> Name
                </label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  disabled={!editing}
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground flex items-center gap-2 mb-1">
                  <Mail className="w-4 h-4" /> Email
                </label>
                <Input
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  disabled // usually immutable
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground flex items-center gap-2 mb-1">
                  <Phone className="w-4 h-4" /> Phone
                </label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  disabled={!editing}
                  placeholder="+977 98XXXXXXXX"
                />
              </div>
            </div>
            </CardContent>
          </Card>
          )}

          {activeTab === 'security' && (
          <Card className="border-none shadow-sm bg-card">
            <CardHeader>
              <CardTitle className="text-lg">Security</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
            <label className="text-sm text-muted-foreground flex items-center gap-2">
              <Key className="w-4 h-4" /> Change Password
            </label>
            <Input
              type="password"
              placeholder="Current password"
              value={pwd.current}
              onChange={(e) => setPwd((p) => ({ ...p, current: e.target.value }))}
            />
            <Input
              type="password"
              placeholder="New password"
              value={pwd.next}
              onChange={(e) => setPwd((p) => ({ ...p, next: e.target.value }))}
            />
            <Input
              type="password"
              placeholder="Confirm new password"
              value={pwd.confirm}
              onChange={(e) => setPwd((p) => ({ ...p, confirm: e.target.value }))}
            />
            <Button onClick={onChangePassword} disabled={pwdSaving}>
              {pwdSaving ? "Updating..." : "Update Password"}
            </Button>
            <Separator className="my-2" />
            <Button variant="destructive" onClick={onDeleteAccount}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Account
            </Button>
            </CardContent>
          </Card>
          )}

      {activeTab === 'orders' && (
        <Card className="border-none shadow-sm bg-card">
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-lg">My Orders</CardTitle>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Input placeholder="Search..." value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} />
              <Button variant="outline" type="button">Filter</Button>
              <Button variant="ghost" onClick={() => { loadMy(); }} title="Refresh">{loadingMy ? 'Loading...' : 'Refresh'}</Button>
            </div>
          </CardHeader>
          <CardContent>
            {!hasLoadedMy && loadingMy ? (
              <p>Loading orders...</p>
            ) : myOrders.length === 0 ? (
              <div className="text-muted-foreground">No orders yet. <a href="/shop" className="text-thrift-green hover:underline">Shop now</a></div>
            ) : (
              <div className="space-y-3">
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
                      {paginate(filteredOrders).map(o => (
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
              </div>
            )}
          </CardContent>
        </Card>
      )}
            </div>
          </div>
        </div>
      );
    }