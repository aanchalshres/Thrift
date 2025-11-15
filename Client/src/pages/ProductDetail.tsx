import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { ProductCard } from "@/components/product/ProductCard";
import { toast } from "sonner";

type Product = {
  id: string | number;
  title: string;
  price: number;
  originalPrice?: number | null;
  category?: string;
  condition?: string;
  size?: string;
  brand?: string;
  description?: string;
  seller?: string;
  phone?: string | null;
  images?: string[];
  image?: string;
  location?: string;
  status?: string;
  is_verified_seller?: boolean;
  sellerId?: number | null;
};

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const apiBase = import.meta.env.VITE_API_URL || "https://thrift-production-af9f.up.railway.app";
  const { user, token } = useAuth();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [contactOpen, setContactOpen] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [similar, setSimilar] = useState<Product[]>([]);
  const [trustLoading, setTrustLoading] = useState(false);
  const [trustSummary, setTrustSummary] = useState<{ percentage: number; total: number; avgRating: number | null } | null>(null);

  // Add to cart helper
  const addToCart = () => {
    if (!product) return;
    if (!token) {
      const next = encodeURIComponent(location.pathname + location.search);
      toast("Please sign in to add items", { description: "You need an account to use the cart." });
      navigate(`/signup?next=${next}`);
      return;
    }
    const st = String(product.status || '').toLowerCase();
    if (st && st !== 'unsold') {
      toast.error('Item cannot be added to cart', { description: `This listing is ${st.replace('_',' ')}` });
      return;
    }
    const cart: Array<{ id: string; title: string; price: number; image: string; quantity?: number }> =
      JSON.parse(localStorage.getItem("cart") || "[]");

    const idStr = String(product.id);
    const image = Array.isArray(product.images) && product.images.length > 0
      ? product.images[0]
      : (product.image || "");
    const title = product.title || "Item";
    const price = Number(product.price || 0);

    const idx = cart.findIndex((c) => String(c.id) === idStr);
    if (idx >= 0) {
      try { window.dispatchEvent(new CustomEvent("cartUpdated", { detail: { count: cart.length } })); } catch {}
      toast.info("Item already in cart", { description: title });
      return;
    }
    cart.push({ id: idStr, title, price, image, quantity: 1 });
    localStorage.setItem("cart", JSON.stringify(cart));
    try { window.dispatchEvent(new CustomEvent("cartUpdated", { detail: { count: cart.length } })); } catch {}
    toast.success("Added to cart", { description: title });
  };

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${apiBase}/api/products/${id}`);
        if (!res.ok) throw new Error(`Failed to load product ${id}`);
        const data = await res.json();
        setProduct(data);
        setSelectedIdx(0);
      } catch (e: any) {
        setError(e?.message || "Failed to load product");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, apiBase]);

  // Load seller trust summary
  useEffect(() => {
    const fetchTrust = async () => {
      if (!product || !product.sellerId) return;
      setTrustLoading(true);
      try {
        const res = await fetch(`${apiBase}/api/sellers/${product.sellerId}/feedback/summary`);
        if (res.ok) {
          const data = await res.json();
          setTrustSummary({ percentage: Number(data.percentage || 0), total: Number(data.total || 0), avgRating: data.avgRating != null ? Number(data.avgRating) : null });
        }
      } catch {
        setTrustSummary(null);
      } finally {
        setTrustLoading(false);
      }
    };
    fetchTrust();
  }, [product, apiBase]);

  useEffect(() => {
    const loadSimilar = async () => {
      if (!product) return;
      try {
        const res = await fetch(`${apiBase}/api/products`);
        if (!res.ok) return;
        const all = await res.json();
        const pid = String(product.id);
        const basePrice = Number(product.price || 0);
        const hasCategory = !!(product as any).category;
        const norm = (v: any) => String(v || '').trim().toLowerCase();
        const cat = norm((product as any).category);
        const within = (p: any) => {
          const price = Number(p.price || 0);
          if (!basePrice) return true;
          const low = basePrice * 0.7;
          const high = basePrice * 1.3;
          return price >= low && price <= high;
        };
        const candidates: Product[] = (Array.isArray(all) ? all : [])
          .filter((p: any) => String(p.id) !== pid)
          .filter((p: any) => (hasCategory ? norm(p.category || p.Category) === cat : true))
          .filter(within)
          .slice(0, 6);
        setSimilar(candidates);
      } catch {}
    };
    loadSimilar();
  }, [product, apiBase]);

  // Prefill contact info
  useEffect(() => {
    setContactName(user?.name || "");
  }, [user]);

  const mainImage = useMemo(() => {
    if (!product) return "/placeholder-product.jpg";
    if (Array.isArray(product.images) && product.images.length > 0) {
      const idx = Math.min(Math.max(selectedIdx, 0), product.images.length - 1);
      return product.images[idx];
    }
    if (product.image) return product.image;
    return "/placeholder-product.jpg";
  }, [product, selectedIdx]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="mb-4">
          <Button variant="ghost" onClick={() => navigate('/shop')}>← Back to Shop</Button>
        </div>
        <p>Loading...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="mb-4">
          <Button variant="ghost" onClick={() => navigate(-1)}>← Back</Button>
        </div>
        <p className="text-destructive">{error || "Product not found"}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate('/shop')}>
          ← Back to Shop
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-12">
        {/* Product Images */}
        <div>
          <div className="relative w-full overflow-hidden rounded-lg border bg-black/5 aspect-[3/4]">
            <img
              src={mainImage}
              alt={product.title}
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
          {Array.isArray(product.images) && product.images.length > 1 && (
            <div className="mt-4 grid grid-cols-4 gap-2">
              {product.images.slice(0, 8).map((img, idx) => (
                <img
                  key={idx}
                  src={img}
                  alt={`thumb-${idx}`}
                  onClick={() => setSelectedIdx(idx)}
                  className={
                    "h-20 w-full object-cover rounded border cursor-pointer " +
                    (idx === selectedIdx ? "ring-2 ring-thrift-green" : "hover:opacity-90")
                  }
                />
              ))}
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="space-y-6">
          <div>
            <h1 className="text-4xl font-bold mb-2">{product.title}</h1>
            {product.brand && <p className="text-gray-600">{product.brand}</p>}
          </div>

          <div className="flex items-center gap-4">
            <span className="text-3xl font-bold text-thrift-green">
              NPR {Number(product.price || 0).toLocaleString()}
            </span>
            {!!product.originalPrice && (
              <>
                <span className="text-xl text-gray-400 line-through">
                  NPR {Number(product.originalPrice).toLocaleString()}
                </span>
                {Number(product.originalPrice) > Number(product.price || 0) && (
                  <span className="inline-flex items-center rounded-full bg-thrift-green text-white text-xs font-semibold px-2 py-1">
                    -{Math.max(0, Math.round(100 - (Number(product.price || 0) / Number(product.originalPrice)) * 100))}%
                  </span>
                )}
              </>
            )}
          </div>

          <div className="space-y-2">
            {product.condition && (
              <p><span className="font-semibold">Condition:</span> {product.condition}</p>
            )}
            {product.size && (
              <p><span className="font-semibold">Size:</span> {product.size}</p>
            )}
            {product.location && (
              <p><span className="font-semibold">Location:</span> {product.location}</p>
            )}
            {product.seller && (
              <p className="select-none flex items-center gap-2">
                <span className="font-semibold">Seller:</span> {product.seller}
                {/* Legacy verified badge deprecated; trust summary shown instead */}
                {trustLoading && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">Loading trust…</span>
                )}
                {!trustLoading && trustSummary && trustSummary.total > 0 && (
                  <span title="Buyer feedback summary" className="inline-flex items-center gap-1 rounded-full bg-thrift-green text-white px-2 py-0.5 text-[10px] font-semibold">
                    {trustSummary.percentage}% as-described · {trustSummary.avgRating != null ? `★${trustSummary.avgRating.toFixed(1)}` : 'No rating'} ({trustSummary.total})
                  </span>
                )}
                {!trustLoading && (!trustSummary || trustSummary.total === 0) && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600" title="No buyer feedback yet">No feedback yet</span>
                )}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              For privacy, phone numbers and emails aren’t shown. Use the message button to contact the seller.
            </p>
          </div>

          {product.description && (
            <p className="text-gray-700">{product.description}</p>
          )}

          <div className="flex gap-4">
            {
              (() => {
                const st = String(product.status || '').toLowerCase();
                const disabled = !!st && st !== 'unsold';
                const label = disabled ? (st === 'sold' ? 'Sold' : 'Not available') : 'Add to Cart';
                return (
                  <Button className={`flex-1 py-2 px-4 text-sm rounded-full shadow-sm transition transform hover:-translate-y-[1px] ${disabled ? 'cursor-not-allowed bg-gray-200 text-gray-700' : 'bg-thrift-green hover:bg-thrift-green/90 text-white'}`} onClick={addToCart} disabled={disabled}>
                    <ShoppingCart className="w-5 h-5 mr-2" />
                    {label}
                  </Button>
                );
              })()
            }
            <Button variant="outline" onClick={() => setContactOpen(true)}>
              Message Seller
            </Button>
          </div>
        </div>
      </div>

      {banner && (
        <div className="mt-6 text-sm text-thrift-green bg-thrift-green/10 border border-thrift-green/20 rounded p-3">
          {banner}
        </div>
      )}

      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contact Seller</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Your name" value={contactName} onChange={(e) => setContactName(e.target.value)} />
            <Textarea rows={4} placeholder="Write your message..." value={contactMessage} onChange={(e) => setContactMessage(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContactOpen(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!contactMessage.trim()) return;
                setSending(true);
                try {
                  const resp = await fetch(`${apiBase}/api/products/${id}/message`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                    body: JSON.stringify({ name: contactName || undefined, message: contactMessage.trim() }),
                  });
                  if (!resp.ok) {
                    const t = await resp.text();
                    throw new Error(t || 'Failed to send');
                  }
                  setContactOpen(false);
                  setBanner("Message sent to the seller. You'll get a reply soon.");
                  setTimeout(() => setBanner(null), 3000);
                  setContactMessage("");
                } catch (e: any) {
                  setBanner(e?.message || 'Failed to send message');
                  setTimeout(() => setBanner(null), 3000);
                } finally {
                  setSending(false);
                }
              }}
              disabled={sending || !contactMessage.trim()}
            >
              {sending ? "Sending..." : "Send Message"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Similar Items */}
      {similar.length > 0 && (
        <div className="mt-16">
          <h2 className="text-2xl font-semibold mb-4">Similar items you might like</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {similar.map((p) => {
              const images = Array.isArray(p.images)
                ? p.images
                : (typeof (p as any).images === 'string' && (p as any).images.startsWith('[')
                    ? JSON.parse((p as any).images)
                    : ((p as any).image ? [(p as any).image] : []));
              const brand = (p as any).brand || '';
              const size = (p as any).size || '';
              const condition = (p as any).productCondition || (p as any).condition || 'Good';
              const seller = (p as any).seller || '';
              const location = (p as any).location || '';
              const status = (p as any).status || '';
              return (
                <div key={String(p.id)} onClick={() => navigate(`/product/${p.id}`)} className="cursor-pointer">
                  <ProductCard
                    id={String(p.id)}
                    title={p.title}
                    price={Number(p.price || 0)}
                    originalPrice={p.originalPrice != null ? Number(p.originalPrice) : undefined}
                    brand={brand}
                    size={size}
                    condition={condition as any}
                    images={Array.isArray(images) && images.length > 0 ? images : ["https://via.placeholder.com/300"]}
                    seller={seller}
                    location={location}
                    status={status}
                    isVerifiedSeller={Boolean((p as any).is_verified_seller)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}