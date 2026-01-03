import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const apiBase = import.meta.env.VITE_API_URL || "https://thrift-production-af9f.up.railway.app";

  const [order, setOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const [sellers, setSellers] = useState<Array<{ sellerId: number; seller: string }>>([]);
  const [feedback, setFeedback] = useState<{ sellerId?: number; rating: number; as_described: boolean; comment: string }>({ rating: 5, as_described: true, comment: '' });
  const [submitting, setSubmitting] = useState(false);
  const [reviewsBySeller, setReviewsBySeller] = useState<Record<number, { rating: number | null; as_described: boolean; comment?: string | null; created_at?: string }>>({});

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        // Fetch my orders and find the requested one (buyer-only detail)
        const res = await fetch(`${apiBase}/api/orders/mine`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (!res.ok) throw new Error('Failed to fetch orders');
        const data = await res.json();
        const arr = Array.isArray(data) ? data : [];
        const found = arr.find((o: any) => String(o.id) === String(id) || String(o.order_id) === String(id));
        if (!found) {
          setError('Order not found or you do not have access');
          setOrder(null);
        } else {
          // ensure shipping_address is parsed
          try {
            if (found && typeof found.shipping_address === 'string') {
              found.shipping_address = JSON.parse(found.shipping_address || '{}');
            }
          } catch (e) { found.shipping_address = found.shipping_address || {}; }
          setOrder(found);
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to load order');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, apiBase, token]);

  // If arriving from a successful payment, clear cart once when order is paid
  useEffect(() => {
    if (!order) return;
    const paid = String(order.payment_status || order.paymentStatus || '').toLowerCase() === 'paid';
    if (!paid) return;
    const oid = Number(order.id || order.order_id);
    if (!oid) return;
    const sessKey = `cartClearedForOrder_${oid}`;
    try {
      if (!sessionStorage.getItem(sessKey)) {
        localStorage.setItem('cart', JSON.stringify([]));
        try { window.dispatchEvent(new CustomEvent('cartUpdated', { detail: { count: 0 } })); } catch {}
        sessionStorage.setItem(sessKey, '1');
      }
    } catch {}
  }, [order]);

  // Resolve sellers for this order by fetching product details for each item
  useEffect(() => {
    const resolveSellers = async () => {
      try {
        if (!order || !Array.isArray(order.items) || order.items.length === 0) return;
        const seen = new Map<number, string>();
        await Promise.all(order.items.map(async (it: any) => {
          const pid = Number(it.product_id || it.productId);
          if (!pid) return;
          try {
            const res = await fetch(`${apiBase}/api/products/${pid}`);
            if (!res.ok) return;
            const p = await res.json();
            const sid = Number(p.sellerId || p.user_id);
            if (sid && !seen.has(sid)) seen.set(sid, p.seller || `Seller #${sid}`);
          } catch {}
        }));
        const list = Array.from(seen.entries()).map(([sellerId, seller]) => ({ sellerId, seller }));
        setSellers(list);
        if (list.length === 1) setFeedback(prev => ({ ...prev, sellerId: list[0].sellerId }));
      } catch {}
    };
    resolveSellers();
  }, [order, apiBase]);

  // Once sellers are known, fetch existing reviews by current user for this order
  useEffect(() => {
    const loadExisting = async () => {
      try {
        if (!order || !token || !sellers.length) return;
        const myId = (() => {
          try { const payload = JSON.parse(atob((token.split('.')[1]||'') )); return Number(payload.userId || payload.id) || null; } catch { return null; }
        })();
        if (!myId) return;
        const oid = Number(order.id || order.order_id);
        const map: Record<number, { rating: number | null; as_described: boolean; comment?: string | null; created_at?: string }> = {};
        await Promise.all(sellers.map(async s => {
          try {
            const res = await fetch(`${apiBase}/api/sellers/${s.sellerId}/feedback`);
            if (!res.ok) return;
            const rows = await res.json();
            const mine = (Array.isArray(rows) ? rows : []).find((r: any) => Number(r.buyer_id) === myId && Number(r.order_id) === oid);
            if (mine) {
              map[s.sellerId] = { rating: mine.rating != null ? Number(mine.rating) : null, as_described: Boolean(mine.as_described), comment: mine.comment || null, created_at: mine.created_at };
            }
          } catch {}
        }));
        setReviewsBySeller(map);
      } catch {}
    };
    loadExisting();
  }, [sellers, order, token, apiBase]);

  const canLeaveFeedback = useMemo(() => {
    if (!order) return false;
    const paid = String(order.payment_status || order.paymentStatus || '').toLowerCase() === 'paid';
    const cancelled = String(order.status || order.order_status || '').toLowerCase() === 'cancelled';
    return paid && !cancelled;
  }, [order]);

  const submitFeedback = async () => {
    if (!order) return;
    const oid = Number(order.id || order.order_id);
    const sid = Number(feedback.sellerId || 0);
    if (sellers.length > 1 && !sid) {
      toast({ title: 'Select seller', description: 'Choose which seller to review for this order.' });
      return;
    }
    setSubmitting(true);
    try {
      const resp = await fetch(`${apiBase}/api/sellers/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ orderId: oid, sellerId: sid || undefined, rating: feedback.rating, as_described: feedback.as_described, comment: feedback.comment || undefined }),
      });
      if (resp.status === 409) {
        toast({ title: 'Already submitted', description: 'You have already left feedback for this order/seller.' });
        return;
      }
      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(t || 'Feedback failed');
      }
      toast({ title: 'Thanks for your feedback!', description: 'Your review helps build seller trust.' });
      const entry = { rating: feedback.rating, as_described: feedback.as_described, comment: feedback.comment, created_at: new Date().toISOString() };
      const sidToSet = sid || (sellers.length === 1 ? sellers[0].sellerId : undefined);
      if (sidToSet) setReviewsBySeller(prev => ({ ...prev, [sidToSet]: entry }));
      setFeedback({ rating: 5, as_described: true, comment: '', sellerId: sellers.length === 1 ? sellers[0].sellerId : undefined });
    } catch (e: any) {
      toast({ title: 'Unable to submit', description: e?.message || 'Please try again' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!order) return;
    const ok = window.confirm('Cancel this order? This will attempt to release the items back to unsold state.');
    if (!ok) return;
    try {
      const res = await fetch(`${apiBase}/api/orders/${order.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Failed to cancel order');
      }
      const updated = await res.json();
      try { if (typeof updated.shipping_address === 'string') updated.shipping_address = JSON.parse(updated.shipping_address || '{}'); } catch(e){ updated.shipping_address = updated.shipping_address || {}; }
      setOrder(updated);
  // Notify other UI (Profile list) to refresh
  try { window.dispatchEvent(new CustomEvent('orderUpdated', { detail: { id: updated.id, status: updated.status || 'cancelled' } })); } catch (e) {}
      toast({ title: 'Order cancelled', description: `Order #${order.id} marked cancelled.` });
    } catch (e: any) {
      toast({ title: 'Unable to cancel', description: e?.message || 'Cancel failed' });
    }
  };

  if (loading) return (<div className="container mx-auto px-4 py-16">Loading...</div>);
  if (error) return (
    <div className="container mx-auto px-4 py-16">
      <div className="mb-4">
        <Button variant="ghost" onClick={() => navigate(-1)}>← Back</Button>
      </div>
      <Card className="border-none shadow-sm"><CardContent className="p-6 text-destructive">{error}</CardContent></Card>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate('/profile?tab=orders')}>← Back to Orders</Button>
      </div>
      <div className="flex justify-center">
        <Card className="border-none shadow-sm bg-card w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-center">Order Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="text-sm text-muted-foreground">Order ID: <span className="font-semibold">{order.id || order.order_id}</span></div>
            <div className="text-sm">Placed on: <span className="font-medium">{new Date(order.created_at || order.createdAt).toLocaleString()}</span></div>
            {order.shipping_address && (
              <div className="text-sm">Shipping Address: <span className="font-medium">{order.shipping_address.address || order.shipping_address.address_line || order.shipping_address.city || '-'}</span></div>
            )}
            <div className="mt-2">Status: <span className={`font-semibold ${String(order.status || order.order_status || '').toLowerCase() === 'cancelled' ? 'text-red-600' : String(order.status || order.order_status || '').toLowerCase() === 'sold' ? 'text-gray-600' : 'text-thrift-green'}`}>{order.status || order.order_status || 'pending'}</span></div>
          </div>
          <div className="mb-4 border rounded overflow-hidden">
            <div className="grid grid-cols-3 bg-[hsl(var(--thrift-green))] text-white text-sm">
              <div className="p-2 font-medium">Payment Method</div>
              <div className="p-2 font-medium">Payment Status</div>
              <div className="p-2 font-medium">Total Amount</div>
            </div>
            <div className="grid grid-cols-3 text-sm">
              <div className="p-2">{order.payment_method || order.paymentMethod || '-'}</div>
              <div className="p-2">{order.payment_status || order.paymentStatus || 'pending'}</div>
              <div className="p-2">NPR {Number(order.total || 0).toLocaleString()}</div>
            </div>
          </div>

          <div className="mb-4">
            <div className="font-medium">Customer Details:</div>
            <div className="text-sm">{order.user_name || order.buyer_name || order.shipping_address?.name || order.email || '-'}</div>
          </div>

          <div>
            <div className="font-medium mb-2">Product Details:</div>
            <div className="text-sm text-muted-foreground">{(order.items || []).length} item(s)</div>
            {(order.items || []).map((it: any, i: number) => (
              <div key={i} className="mt-2 border rounded p-3">
                <div className="font-medium">Name: {it.title}</div>
                <div className="text-sm">Description: {it.description || it.title || ''}</div>
                <div className="text-sm">Unit: {it.unit || 'unit'}</div>
                <div className="text-sm">Quantity: {it.quantity || 1}</div>
                <div className="text-sm font-semibold">Price: NPR {Number(it.price || 0).toLocaleString()}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex justify-end">
            {/* Only show cancel when not already cancelled or completed */}
            {String((order.status || order.order_status || '')).toLowerCase() !== 'cancelled' && String((order.status || order.order_status || '')).toLowerCase() !== 'sold' && (
              <Button variant="destructive" onClick={handleCancel}>Cancel Order</Button>
            )}
          </div>

          {/* Buyer Feedback */}
          {canLeaveFeedback && (
            <div className="mt-8 border-t pt-6">
              <h3 className="font-semibold mb-2">How was your purchase?</h3>
              {/* If single seller and already reviewed, show the review and no form */}
              {sellers.length === 1 && reviewsBySeller[sellers[0].sellerId] && (
                <div className="rounded-md border p-4 bg-card/50">
                  <div className="text-sm mb-1">Your review for {sellers[0].seller}:</div>
                  <div className="text-sm">Rating: <span className="font-medium">{reviewsBySeller[sellers[0].sellerId].rating ?? '—'}</span></div>
                  <div className="text-sm">As described: <span className="font-medium">{reviewsBySeller[sellers[0].sellerId].as_described ? 'Yes' : 'No'}</span></div>
                  {reviewsBySeller[sellers[0].sellerId].comment && (
                    <div className="text-sm mt-1">Comment: <span className="font-medium">{reviewsBySeller[sellers[0].sellerId].comment}</span></div>
                  )}
                  <div className="text-[11px] mt-2 text-muted-foreground">Submitted {new Date(reviewsBySeller[sellers[0].sellerId].created_at || Date.now()).toLocaleString()}</div>
                </div>
              )}

              {/* For multiple sellers, allow selecting seller; if selected is reviewed, show the review instead of form */}
              {sellers.length > 1 && (
                <div className="mb-3 text-sm">
                  <label className="block mb-1">Choose seller to review</label>
                  <select value={feedback.sellerId || ''} onChange={(e) => setFeedback(prev => ({ ...prev, sellerId: e.target.value ? Number(e.target.value) : undefined }))} className="border rounded p-2 text-sm">
                    <option value="">Select seller</option>
                    {sellers.map(s => (
                      <option key={s.sellerId} value={s.sellerId}>{s.seller}</option>
                    ))}
                  </select>
                </div>
              )}
              {!(sellers.length === 1 && reviewsBySeller[sellers[0].sellerId]) && (!feedback.sellerId || !reviewsBySeller[feedback.sellerId]) && (
                <div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                    <div>
                      <label className="block text-sm mb-1">Rating</label>
                      <select value={feedback.rating} onChange={(e) => setFeedback(prev => ({ ...prev, rating: Number(e.target.value) }))} className="border rounded p-2 text-sm w-full">
                        {[5,4,3,2,1].map(r => <option key={r} value={r}>{r} star{r>1?'s':''}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <input id="as-desc" type="checkbox" checked={feedback.as_described} onChange={(e) => setFeedback(prev => ({ ...prev, as_described: e.target.checked }))} />
                      <label htmlFor="as-desc" className="text-sm">Item as described</label>
                    </div>
                  </div>
                  <div className="mt-3">
                    <Textarea placeholder="Optional comment" value={feedback.comment} onChange={(e) => setFeedback(prev => ({ ...prev, comment: e.target.value }))} />
                  </div>
                  <div className="mt-3">
                    <Button onClick={submitFeedback} disabled={submitting || (sellers.length > 1 && !feedback.sellerId)}>
                      {submitting ? 'Submitting…' : 'Submit Feedback'}
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Feedback is tied to this order to help others trust sellers. One feedback per seller per order.</p>
                </div>
              )}

              {/* For multi-seller, if the selected seller already has a review, show it */}
              {sellers.length > 1 && feedback.sellerId && reviewsBySeller[feedback.sellerId] && (
                <div className="rounded-md border p-4 bg-card/50">
                  <div className="text-sm mb-1">Your review for {sellers.find(s => s.sellerId === feedback.sellerId)?.seller}:</div>
                  <div className="text-sm">Rating: <span className="font-medium">{reviewsBySeller[feedback.sellerId].rating ?? '—'}</span></div>
                  <div className="text-sm">As described: <span className="font-medium">{reviewsBySeller[feedback.sellerId].as_described ? 'Yes' : 'No'}</span></div>
                  {reviewsBySeller[feedback.sellerId].comment && (
                    <div className="text-sm mt-1">Comment: <span className="font-medium">{reviewsBySeller[feedback.sellerId].comment}</span></div>
                  )}
                  <div className="text-[11px] mt-2 text-muted-foreground">Submitted {new Date(reviewsBySeller[feedback.sellerId].created_at || Date.now()).toLocaleString()}</div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
