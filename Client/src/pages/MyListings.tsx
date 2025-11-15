import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export default function MyListings() {
  const { token, user } = useAuth();
  const apiBase = useMemo(() => import.meta.env.VITE_API_URL || "https://thrift-production-af9f.up.railway.app", []);
  const headers = useMemo(() => token ? { Authorization: `Bearer ${token}` } : {}, [token]);

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<any | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editFields, setEditFields] = useState({
    title: "",
    price: "",
    brand: "",
    size: "",
    condition: "",
    location: "",
  });
  const [newImages, setNewImages] = useState<FileList | null>(null);
  const [toDeleteImages, setToDeleteImages] = useState<string[]>([]);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/products/mine`, { headers });
      if (!res.ok) throw new Error("Failed to fetch my listings");
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token]);

  const navigate = useNavigate();

  const setStatus = async (id: number | string, status: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${apiBase}/api/products/${id}`, {
        method: "PUT",
        headers: { ...(headers as any) },
        body: new URLSearchParams({ status }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      // Optimistic refresh
      setItems(prev => prev.map(p => String(p.id) === String(id) ? { ...p, status } : p));
    } catch (e) {
      // fallback: reload
      await load();
    }
  };

  const onDelete = async (id: number | string) => {
    if (!token) return;
    if (!confirm("Delete this listing? This cannot be undone.")) return;
    try {
      const res = await fetch(`${apiBase}/api/products/${id}`, {
        method: "DELETE",
        headers: { ...(headers as any) },
      });
      if (!res.ok) throw new Error(await res.text());
      setItems(prev => prev.filter(p => String(p.id) !== String(id)));
    } catch (e: any) {
      alert(e?.message || "Failed to delete");
    }
  };

  const onOpenEdit = (p: any) => {
    setEditItem(p);
    setEditFields({
      title: p.title || "",
      price: String(p.price ?? ""),
      brand: p.brand || "",
      size: p.size || "",
      condition: p.productCondition || "",
      location: p.location || "",
    });
    setNewImages(null);
    setToDeleteImages([]);
    setEditOpen(true);
  };

  const onSaveEdit = async () => {
    if (!token || !editItem) return;
    setEditSaving(true);
    try {
      const form = new FormData();
      form.append("title", editFields.title);
      form.append("price", String(Number(editFields.price) || 0));
      if (editFields.brand) form.append("brand", editFields.brand);
      if (editFields.size) form.append("size", editFields.size);
      if (editFields.condition) form.append("productCondition", editFields.condition);
      if (editFields.location) form.append("location", editFields.location);
      if (toDeleteImages.length > 0) form.append("deleteImages", JSON.stringify(toDeleteImages));
      if (newImages && newImages.length > 0) {
        Array.from(newImages).forEach(f => form.append("images", f));
      }
      const res = await fetch(`${apiBase}/api/products/${editItem.id}`, {
        method: "PUT",
        headers: { ...(headers as any) },
        body: form,
      });
      if (!res.ok) throw new Error(await res.text());
      // Reload this item list to refresh images and fields
      await load();
      setEditOpen(false);
    } catch (e: any) {
      alert(e?.message || "Failed to update");
    } finally {
      setEditSaving(false);
    }
  };

  const normStatus = (s: any) => String(s || "unsold").toLowerCase();
  const statusColor = (s: string) => {
    switch (normStatus(s)) {
      case "sold": return "bg-thrift-green text-white";
      case "order_received": return "bg-warning text-warning-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const filtered = items.filter(p => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return String(p.title || "").toLowerCase().includes(q) || String(p.brand || "").toLowerCase().includes(q);
  });

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-16">
        <h1 className="text-2xl font-bold">My Listings</h1>
        <p className="text-muted-foreground mt-2">No user session found.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">My Listings</h1>
        <div className="flex items-center gap-2">
          <Input placeholder="Filter by title or brand" value={filter} onChange={e => setFilter(e.target.value)} className="w-56" />
          <Button variant="ghost" onClick={load} title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {error && <div className="mb-4 text-sm text-destructive">{error}</div>}

      <Card className="border-none shadow-sm bg-card">
        <CardHeader>
          <CardTitle className="text-lg">Listings ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && !items.length ? (
            <p>Loading…</p>
          ) : filtered.length === 0 ? (
            <div className="text-muted-foreground">No listings found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto border-collapse">
                <thead>
                  <tr className="text-left text-sm text-muted-foreground border-b">
                    <th className="px-3 py-2">Image</th>
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">Price</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr
                      key={p.id}
                      role="link"
                      tabIndex={0}
                      onClick={() => navigate(`/product/${p.id}`)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/product/${p.id}`); } }}
                      className="align-top border-b last:border-b-0 hover:bg-[hsl(var(--thrift-green))]/5 transition cursor-pointer"
                    >
                      <td className="px-3 py-3 w-24">
                        {p.image ? (
                          <img src={p.image} alt={p.title ? `${p.title}` : 'Listing image'} className="w-20 h-14 object-cover rounded" />
                        ) : (
                          <div className="w-20 h-14 bg-muted grid place-items-center text-xs text-muted-foreground rounded">No image</div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium">{p.title}</div>
                        <div className="text-xs text-muted-foreground">{p.brand || ''} {p.size ? `• ${p.size}` : ''}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-semibold text-thrift-green">NPR {Number(p.price || 0).toLocaleString()}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <Badge className={statusColor(p.status)}>{normStatus(p.status).replace("order_received", "Order received").replace("unsold", "Unsold").replace("sold", "Sold")}</Badge>
                          <select
                            value={normStatus(p.status)}
                            onChange={(e) => { e.stopPropagation(); setStatus(p.id, e.target.value); }}
                            onClick={(e) => e.stopPropagation()}
                            className="text-sm border rounded px-2 py-1 bg-white"
                            aria-label={`Change status for ${p.title}`}
                          >
                            <option value="unsold">Unsold</option>
                            <option value="order_received">Order received</option>
                            <option value="sold">Sold</option>
                          </select>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); onOpenEdit(p); }}>Edit</Button>
                          <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); onDelete(p.id); }}>Delete</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Listing</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Title</label>
              <Input value={editFields.title} onChange={(e) => setEditFields(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Price (NPR)</label>
              <Input type="number" value={editFields.price} onChange={(e) => setEditFields(f => ({ ...f, price: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Brand</label>
              <Input value={editFields.brand} onChange={(e) => setEditFields(f => ({ ...f, brand: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Condition</label>
                <Input value={editFields.condition} onChange={(e) => setEditFields(f => ({ ...f, condition: e.target.value }))} placeholder="new / excellent / good / fair" />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Size</label>
                <Input value={editFields.size} onChange={(e) => setEditFields(f => ({ ...f, size: e.target.value }))} placeholder="e.g., M" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Location</label>
              <Input value={editFields.location} onChange={(e) => setEditFields(f => ({ ...f, location: e.target.value }))} />
            </div>
            {/* Images manager */}
            {editItem && (
              <div className="space-y-2">
                <label className="text-sm font-medium mb-1 block">Images</label>
                <div className="flex flex-wrap gap-2">
                  {(Array.isArray(editItem.images) ? editItem.images : []).map((url: string) => (
                    <div key={url} className="relative group">
                      <img src={url} alt="" className="w-20 h-20 object-cover rounded border" />
                      <button
                        type="button"
                        className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full px-2 py-0.5 opacity-0 group-hover:opacity-100"
                        onClick={(e) => { e.stopPropagation(); setToDeleteImages(prev => prev.includes(url) ? prev : [...prev, url]); }}
                        title="Remove image"
                      >✕</button>
                      {toDeleteImages.includes(url) && (
                        <div className="absolute inset-0 bg-black/40 grid place-items-center text-white text-xs rounded">Will remove</div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground">Click ✕ to mark for removal. Changes apply after Save.</div>
                <div className="pt-2">
                  <label className="text-sm font-medium mb-2 block">Add images</label>
                  <input type="file" accept="image/*" multiple onChange={(e) => setNewImages(e.target.files)} />
                  <div className="text-xs text-muted-foreground mt-1">You can add more images (up to 8 total). First added may become the cover if none exists.</div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button disabled={editSaving} onClick={onSaveEdit}>{editSaving ? "Saving..." : "Save Changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
