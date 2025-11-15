import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Link } from "react-router-dom";
import { Heart, Trash2, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export interface Product {
  id: string;
  title: string;
  price: number;
  originalPrice: number;
  brand: string;
  size: string;
  condition: "Excellent" | "Good";
  images: string[];
  seller: string;
  location: string;
}

interface WishlistContextType {
  wishlist: Product[];
  addToWishlist: (product: Product) => void;
  removeFromWishlist: (id: string) => void;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export const WishlistProvider = ({ children }: { children: ReactNode }) => {
  const [wishlist, setWishlist] = useState<Product[]>([]);

  // Load wishlist from localStorage on mount
  useEffect(() => {
    const storedWishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');
    setWishlist(storedWishlist);
  }, []);

  // Save wishlist to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('wishlist', JSON.stringify(wishlist));
  }, [wishlist]);

  const addToWishlist = (product: Product) => {
    setWishlist((prev) => {
      if (prev.find((item) => item.id === product.id)) {
        return prev; // Prevent duplicates
      }
      return [...prev, product];
    });
  };

  const removeFromWishlist = (id: string) => {
    setWishlist((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <WishlistContext.Provider value={{ wishlist, addToWishlist, removeFromWishlist }}>
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return context;
};

type WishlistItem = {
  id: string;
  title: string;
  price: number;
  image?: string;
};

export default function Wishlist() {
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated, token } = useAuth();
  const apiBase = import.meta.env.VITE_API_URL || "https://thrift-production-af9f.up.railway.app";

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        // If authenticated, use DB-backed wishlist
        if (isAuthenticated && token) {
          const resp = await fetch(`${apiBase}/api/wishlist`, { headers: { Authorization: `Bearer ${token}` } });
          if (!resp.ok) throw new Error('Failed to load wishlist');
          const ids: string[] = await resp.json();
          if (!Array.isArray(ids) || ids.length === 0) {
            setWishlist([]);
          } else {
            // Fetch product details for each id
            const prods = await Promise.all(ids.map(async (id) => {
              try {
                const r = await fetch(`${apiBase}/api/products/${id}`);
                if (!r.ok) throw new Error('not ok');
                const p = await r.json();
                const image = Array.isArray(p.images) && p.images.length ? p.images[0] : (p.image || undefined);
                return { id: String(p.id), title: p.title, price: Number(p.price || 0), image } as WishlistItem;
              } catch {
                return null;
              }
            }));
            setWishlist(prods.filter(Boolean) as WishlistItem[]);
          }
          return;
        }
      } catch (e: any) {
        // fall through to local storage
      }
      // Guest or API failed: fallback to localStorage ids and minimal rendering
      try {
        const stored = JSON.parse(localStorage.getItem("wishlist") || "[]");
        const normalized: WishlistItem[] = (Array.isArray(stored) ? stored : []).map((id: string) => ({ id, title: `Product #${id}`, price: 0 }));
        setWishlist(normalized);
      } catch {
        setWishlist([]);
      }
    };
    load().finally(() => setLoading(false));
  }, [apiBase, isAuthenticated, token]);

  const removeItem = async (id: string) => {
    const idStr = String(id);
    setWishlist(prev => prev.filter(w => String(w.id) !== idStr));
    try {
      if (isAuthenticated && token) {
        const resp = await fetch(`${apiBase}/api/wishlist/${idStr}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
        if (!resp.ok) throw new Error('Failed');
      } else {
        const raw = JSON.parse(localStorage.getItem('wishlist') || '[]');
        const arr = Array.isArray(raw) ? raw : [];
        localStorage.setItem('wishlist', JSON.stringify(arr.filter((x: any) => String(x) !== idStr)));
      }
      window.dispatchEvent(new CustomEvent('wishlistUpdated'));
    } catch {}
  };

  const clearAll = async () => {
    const ids = wishlist.map(w => String(w.id));
    setWishlist([]);
    try {
      if (isAuthenticated && token) {
        // Delete one by one (simple, safe). Could be optimized with a bulk endpoint later.
        await Promise.all(ids.map(id => fetch(`${apiBase}/api/wishlist/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })));
      } else {
        localStorage.setItem('wishlist', JSON.stringify([]));
      }
      window.dispatchEvent(new CustomEvent('wishlistUpdated', { detail: { count: 0 } }));
    } catch {}
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="bg-card border-none shadow-sm">
          <CardContent className="p-8 text-center">Loading wishlist…</CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="bg-card border-none shadow-sm">
          <CardContent className="p-8 text-center text-destructive">{error}</CardContent>
        </Card>
      </div>
    );
  }

  if (wishlist.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="bg-card border-none shadow-sm">
          <CardContent className="flex flex-col items-center justify-center p-8 text-center">
            <Heart className="w-12 h-12 text-thrift-green mb-4" />
            <h2 className="text-xl font-medium mb-2">Your wishlist is empty</h2>
            <p className="text-muted-foreground mb-6">Tap the heart on any product to add it here.</p>
            <Link to="/shop">
              <Button className="bg-thrift-green hover:bg-thrift-green/90">Browse Shop</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render products from DB (or minimal fallback for guests)
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2 text-[hsl(var(--thrift-green))]">My Wishlist</h1>
      </div>
      <div className="flex items-center justify-between mb-6">
        <div></div>
        <Button variant="ghost" onClick={clearAll} className="text-thrift-green">Clear All</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {wishlist.map(item => (
          <Card key={item.id} className="border rounded-lg shadow-sm hover:shadow-md transition bg-card">
            <CardContent className="p-4">
              <Link to={`/product/${item.id}`} className="block">
                {item.image && (
                  <img src={item.image} alt={item.title} className="h-48 w-full object-cover rounded-md mb-4" />
                )}
                <div className="font-semibold truncate mb-1">{item.title}</div>
                <div className="text-thrift-green font-bold mb-3">NPR {Number(item.price || 0).toLocaleString()}</div>
              </Link>
              <div className="flex justify-end items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    // add to cart helper
                    (async () => {
                      try {
                        const pid = String(item.id);
                        // fetch product to check status and price if possible
                        const apiBase = import.meta.env.VITE_API_URL || "https://thrift-production-af9f.up.railway.app";
                        const resp = await fetch(`${apiBase}/api/products/${pid}`);
                        if (!resp.ok) throw new Error('Failed to fetch product');
                        const prod = await resp.json();
                        const st = String(prod.status || prod.product_status || '').toLowerCase();
                        if (st && st !== 'unsold') {
                          toast.error('Item cannot be added to cart', { description: `This listing is ${st.replace('_',' ')}` });
                          return;
                        }
                        const cart = JSON.parse(localStorage.getItem('cart') || '[]');
                        const idx = (Array.isArray(cart) ? cart : []).findIndex((c: any) => String(c.id) === pid);
                        if (idx >= 0) {
                          try { window.dispatchEvent(new CustomEvent('cartUpdated', { detail: { count: cart.length } })); } catch {}
                          toast.info('Item already in cart', { description: item.title });
                          return;
                        }
                        const image = item.image || (Array.isArray(prod.images) && prod.images.length ? prod.images[0] : (prod.image || ""));
                        const price = Number(prod.price || item.price || 0);
                        const next = Array.isArray(cart) ? [...cart, { id: pid, title: item.title || prod.title || `Product #${pid}`, price, image, quantity: 1 }] : [{ id: pid, title: item.title || prod.title || `Product #${pid}`, price, image, quantity: 1 }];
                        localStorage.setItem('cart', JSON.stringify(next));
                        try { window.dispatchEvent(new CustomEvent('cartUpdated', { detail: { count: next.length } })); } catch {}
                        toast.success('Added to cart', { description: item.title });
                      } catch (e: any) {
                        // fallback: try minimal add
                        try {
                          const pid = String(item.id);
                          const cart = JSON.parse(localStorage.getItem('cart') || '[]');
                          const idx = (Array.isArray(cart) ? cart : []).findIndex((c: any) => String(c.id) === pid);
                          if (idx >= 0) { toast.info('Item already in cart'); return; }
                          const next = Array.isArray(cart) ? [...cart, { id: pid, title: item.title, price: Number(item.price || 0), image: item.image || '', quantity: 1 }] : [{ id: pid, title: item.title, price: Number(item.price || 0), image: item.image || '', quantity: 1 }];
                          localStorage.setItem('cart', JSON.stringify(next));
                          try { window.dispatchEvent(new CustomEvent('cartUpdated', { detail: { count: next.length } })); } catch {}
                          toast.success('Added to cart', { description: item.title });
                        } catch (ee) {
                          toast.error('Unable to add to cart');
                        }
                      }
                    })();
                  }}
                  className="!text-thrift-green"
                >
                  <ShoppingCart className="w-4 h-4" />
                </Button>

                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); removeItem(item.id); }} className="hover:bg-[hsl(var(--thrift-green))]/10">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}