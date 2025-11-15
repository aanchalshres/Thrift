import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, useLocation, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingCart, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

interface Listing {
  id: string;
  title: string;
  description: string;
  category: string;
  brand: string;
  condition: string;
  size: string;
  price: number;
  originalPrice: number | null;
  location: string;
  images: string[];
  createdAt: string;
  status?: string;
  is_verified_seller?: boolean;
}

// Canonical category mapping to keep Home -> Shop links and backend data consistent
const CATEGORY_CANON = ["women", "men", "kids", "accessories", "shoes"] as const;
type CanonCategory = typeof CATEGORY_CANON[number] | "all";

const canonicalizeCategory = (raw: string | null | undefined): CanonCategory => {
  const v = String(raw || "").trim().toLowerCase();
  if (!v) return "all";
  // strip punctuation like apostrophes and trailing words like "clothing"
  const cleaned = v
    .replace(/’/g, "'")
    .replace(/[^a-z0-9\s']/g, " ")
    .replace(/\b(clothes|clothing|wear|apparel|items|category)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // direct matches
  if ((CATEGORY_CANON as readonly string[]).includes(cleaned)) return cleaned as CanonCategory;

  // common aliases
  if (/^women|^woman|^womens|^lad(y|ies)/.test(cleaned)) return "women";
  if (/^men|^man|^mens|^male|^gent/.test(cleaned)) return "men";
  if (/^kid|^child|^children|^boys?|^girls?/.test(cleaned)) return "kids";
  if (/^shoe|^sneaker|^boot|^heels?/.test(cleaned)) return "shoes";
  if (/^accessor|^bag|^jewel|^belt|^hat|^cap|^scarf/.test(cleaned)) return "accessories";

  return "all";
};

const normalizeCategoryParam = (raw: string | null | undefined): CanonCategory => {
  const c = canonicalizeCategory(raw);
  return (CATEGORY_CANON as readonly string[]).includes(c as string) ? c : "all";
};

const Shop = () => {
  const [listings, setListings] = useState<Listing[]>([]);
  const [filteredListings, setFilteredListings] = useState<Listing[]>([]);
  const [priceFilter, setPriceFilter] = useState("all");
  const [onSaleOnly, setOnSaleOnly] = useState(false);
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false); // UI label "Trusted sellers" (legacy flag for now)
  const [brandFilter, setBrandFilter] = useState<string>("");
  const [conditionFilter, setConditionFilter] = useState<string>("all");
  const [sizeFilter, setSizeFilter] = useState<string>("");
  const [sortOrder, setSortOrder] = useState("default");
  const [isVisible, setIsVisible] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const { isAuthenticated, token } = useAuth();
  const initialQ = (searchParams.get('q') || '').trim();
  const initialCat = (searchParams.get('category') || 'all').toLowerCase();
  const [categoryFilter, setCategoryFilter] = useState<string>(initialCat);
  const [searchQuery, setSearchQuery] = useState(initialQ);
  const apiBase = import.meta.env.VITE_API_URL || "https://thrift-production-af9f.up.railway.app";
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("wishlist") || "[]");
      return new Set(Array.isArray(raw) ? raw.map(String) : []);
    } catch {
      return new Set<string>();
    }
  });

  // Helper: determine if listing is on sale
  const isOnSale = (l: Listing) => l.originalPrice != null && Number(l.originalPrice) > Number(l.price);
  // Helper: determine if listing is featured (server flag if present, else heuristic)
  const isFeatured = (l: Listing, index: number) => {
    const anyServerFlag = (l as any).featured === true || String((l as any).featured).toLowerCase() === 'true';
    if (anyServerFlag) return true;
    const discount = l.originalPrice ? (1 - (l.price / Number(l.originalPrice))) : 0;
    // Heuristic: high discount OR among first few newest
    return discount >= 0.2 || index < 6;
  };

  // Fetch listings from backend products; fallback to localStorage
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch(`${apiBase}/api/products`);
        if (!res.ok) throw new Error("backend not available");
        const data = await res.json();
        const items: Listing[] = (Array.isArray(data) ? data : []).map((p: any) => ({
          id: String(p.id),
          title: p.title,
          description: p.description || "",
          category: canonicalizeCategory(p.category || p.Category || ''),
          brand: p.brand || "",
          condition: p.productCondition || p.condition || "Good",
          size: p.size || "",
          price: Number(p.price ?? 0),
          originalPrice: p.originalPrice != null ? Number(p.originalPrice) : null,
          location: p.location || "",
          images: Array.isArray(p.images)
            ? p.images
            : (typeof p.images === 'string' && p.images.startsWith('[')
                ? JSON.parse(p.images)
                : (p.image ? [p.image] : [])),
          createdAt: p.created_at || p.createdAt || new Date().toISOString(),
          status: (p.status || p.product_status || '').toString(),
          is_verified_seller: p.is_verified_seller === 1 || p.is_verified_seller === true,
        }));
        setListings(items);
        setFilteredListings(items);
      } catch (e) {
        // fallback to localStorage if server not reachable
        const raw = JSON.parse(localStorage.getItem("listings") || "[]");
        const stored: Listing[] = (Array.isArray(raw) ? raw : []).map((p: any) => ({
          id: String(p.id),
          title: p.title,
          description: p.description || "",
          category: canonicalizeCategory(p.category || p.Category || ''),
          brand: p.brand || "",
          condition: p.productCondition || p.condition || "Good",
          size: p.size || "",
          price: Number(p.price ?? 0),
          originalPrice: p.originalPrice != null ? Number(p.originalPrice) : null,
          location: p.location || "",
          images: Array.isArray(p.images)
            ? p.images
            : (typeof p.images === 'string' && p.images.startsWith('[')
                ? JSON.parse(p.images)
                : (p.image ? [p.image] : [])),
          createdAt: p.created_at || p.createdAt || new Date().toISOString(),
          status: (p.status || p.product_status || '').toString(),
          is_verified_seller: p.is_verified_seller === 1 || p.is_verified_seller === true,
        }));
        setListings(stored);
        setFilteredListings(stored);
      }
    };
    fetchProducts();
  }, [apiBase]);

  // Load wishlist ids from API if authenticated; fallback to localStorage
  useEffect(() => {
    const loadWishlist = async () => {
      try {
        if (isAuthenticated && token) {
          const resp = await fetch(`${apiBase}/api/wishlist`, { headers: { Authorization: `Bearer ${token}` } });
          if (resp.ok) {
            const ids = await resp.json();
            setWishlistIds(new Set(Array.isArray(ids) ? ids.map(String) : []));
            return;
          }
        }
      } catch {}
      try {
        const raw = JSON.parse(localStorage.getItem("wishlist") || "[]");
        setWishlistIds(new Set(Array.isArray(raw) ? raw.map(String) : []));
      } catch {
        setWishlistIds(new Set());
      }
    };
    loadWishlist();
  }, [apiBase, isAuthenticated, token]);

  // Keep category and search in sync with URL (on navigation/back/links)
  // If ?reset is present, skip syncing from URL to avoid flip-flop with reset logic
  useEffect(() => {
    if (searchParams.has('reset')) return;
    const qParam = (searchParams.get('q') || '').trim();
    const catParam = normalizeCategoryParam(searchParams.get('category'));
    if (qParam !== searchQuery) setSearchQuery(qParam);
    if (catParam !== categoryFilter) setCategoryFilter(catParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // If user navigates to /shop without filters OR with ?reset=1, reset all local filters to defaults
  useEffect(() => {
    const isShop = location.pathname.toLowerCase() === '/shop';
    const hasAny = searchParams.has('category') || searchParams.has('q');
    const hasReset = searchParams.has('reset');
    if (isShop && (!hasAny || hasReset)) {
      if (categoryFilter !== 'all') setCategoryFilter('all');
      if (searchQuery !== '') setSearchQuery('');
      if (priceFilter !== 'all') setPriceFilter('all');
      if (sortOrder !== 'default') setSortOrder('default');
      if (hasReset) {
        const next = new URLSearchParams(searchParams);
        next.delete('reset');
        next.delete('category');
        next.delete('q');
        setSearchParams(next, { replace: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search, searchParams]);

  // Apply filters and sorting
  useEffect(() => {
    let updatedListings = [...listings];

    // Apply search query (title, description, brand, category, location)
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      updatedListings = updatedListings.filter((l) => {
        const hay = `${l.title} ${l.description} ${l.brand} ${l.category} ${l.location}`.toLowerCase();
        return hay.includes(q);
      });
    }

    // Filter by category
    if (categoryFilter !== "all") {
      updatedListings = updatedListings.filter((listing) => canonicalizeCategory(listing.category) === categoryFilter);
    }

    // Filter by "On Sale"
    if (onSaleOnly) {
      updatedListings = updatedListings.filter(isOnSale);
    }

    // Filter by "Featured"
    if (featuredOnly) {
      updatedListings = updatedListings.filter((l, idx) => isFeatured(l, idx));
    }
    if (verifiedOnly) {
      updatedListings = updatedListings.filter(l => l.is_verified_seller);
    }

    // Filter by brand
    if (brandFilter.trim()) {
      const bf = brandFilter.trim().toLowerCase();
      updatedListings = updatedListings.filter(l => (l.brand || '').toLowerCase().includes(bf));
    }

    // Filter by condition
    if (conditionFilter !== 'all') {
      updatedListings = updatedListings.filter(l => String(l.condition || '').toLowerCase() === conditionFilter);
    }

    // Filter by size (contains)
    if (sizeFilter.trim()) {
      const sf = sizeFilter.trim().toLowerCase();
      updatedListings = updatedListings.filter(l => (l.size || '').toLowerCase().includes(sf));
    }

    // Filter by price range
    if (priceFilter !== "all") {
      updatedListings = updatedListings.filter((listing) => {
        if (priceFilter === "0-1000") return listing.price <= 1000;
        if (priceFilter === "1000-5000") return listing.price > 1000 && listing.price <= 5000;
        if (priceFilter === "5000+") return listing.price > 5000;
        return true;
      });
    }

    // Sort by price
    if (sortOrder !== "default") {
      updatedListings.sort((a, b) =>
        sortOrder === "low-to-high" ? a.price - b.price : b.price - a.price
      );
    }

    setFilteredListings(updatedListings);
  }, [categoryFilter, priceFilter, sortOrder, listings, searchQuery, onSaleOnly, featuredOnly, brandFilter, conditionFilter, sizeFilter, verifiedOnly]);

  // Reflect category/search in URL for shareability (only when changed)
  useEffect(() => {
    const curQ = (searchParams.get('q') || '').trim();
    const curC = normalizeCategoryParam(searchParams.get('category'));
    const next = new URLSearchParams(searchParams);
    let changed = false;

    if (categoryFilter && categoryFilter !== 'all') {
      if (curC !== categoryFilter) {
        next.set('category', categoryFilter);
        changed = true;
      }
    } else if (searchParams.has('category')) {
      next.delete('category');
      changed = true;
    }

    const trimmed = searchQuery.trim();
    if (trimmed) {
      if (curQ !== trimmed) {
        next.set('q', trimmed);
        changed = true;
      }
    } else if (searchParams.has('q')) {
      next.delete('q');
      changed = true;
    }

    if (changed) setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter, searchQuery, searchParams]);

  // Intersection observer for animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    if (gridRef.current) {
      observer.observe(gridRef.current);
    }

    return () => {
      if (gridRef.current) {
        observer.unobserve(gridRef.current);
      }
    };
  }, []);

  // Add to cart: requires auth; single-quantity thrift items (no duplicates)
  const addToCart = (listing: Listing) => {
    if (!isAuthenticated) {
      const next = encodeURIComponent(location.pathname + location.search);
      toast("Please sign in to add items", { description: "You need an account to use the cart." });
      navigate(`/signup?next=${next}`);
      return;
    }
    const st = String(listing.status || '').toLowerCase();
    if (st && st !== 'unsold') {
      toast.error('Item cannot be added to cart', { description: `This listing is ${st.replace('_',' ')}` });
      return;
    }
    const cart: Array<{ id: string; title: string; price: number; image: string; quantity?: number }> =
      JSON.parse(localStorage.getItem("cart") || "[]");

    const idx = cart.findIndex((c) => String(c.id) === String(listing.id));
    if (idx >= 0) {
      // Already in cart: keep single item, notify
      try { window.dispatchEvent(new CustomEvent("cartUpdated", { detail: { count: cart.length } })); } catch {}
      toast.info("Item already in cart", { description: listing.title });
      return;
    }
    cart.push({
      id: String(listing.id),
      title: listing.title,
      price: listing.price,
      image: listing.images[0] || "",
      quantity: 1,
    });
    localStorage.setItem("cart", JSON.stringify(cart));
    try { window.dispatchEvent(new CustomEvent("cartUpdated", { detail: { count: cart.length } })); } catch {}
    toast.success("Added to cart", { description: listing.title });
  };

  const toggleWishlist = async (id: string) => {
    const pid = String(id);
    if (isAuthenticated && token) {
      try {
        if (wishlistIds.has(pid)) {
          const resp = await fetch(`${apiBase}/api/wishlist/${pid}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
          if (!resp.ok) throw new Error('Failed');
          setWishlistIds(prev => { const next = new Set(prev); next.delete(pid); return next; });
          window.dispatchEvent(new CustomEvent("wishlistUpdated", { detail: { count: Math.max(0, wishlistIds.size - 1) } }));
          toast("Removed from wishlist");
          return;
        } else {
          const resp = await fetch(`${apiBase}/api/wishlist`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ productId: pid })
          });
          if (!resp.ok) throw new Error('Failed');
          setWishlistIds(prev => { const next = new Set(prev); next.add(pid); return next; });
          window.dispatchEvent(new CustomEvent("wishlistUpdated", { detail: { count: wishlistIds.size + 1 } }));
          toast.success("Added to wishlist");
          return;
        }
      } catch {
        toast.error("Wishlist update failed", { description: "Using local fallback." });
        // fall back to local behavior on failure
      }
    }
    // Fallback local toggle
    setWishlistIds((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) {
        next.delete(pid);
        toast("Removed from wishlist");
      } else {
        next.add(pid);
        toast.success("Added to wishlist");
      }
      try {
        localStorage.setItem("wishlist", JSON.stringify(Array.from(next)));
        window.dispatchEvent(new CustomEvent("wishlistUpdated", { detail: { count: next.size } }));
      } catch {}
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-background">
    
      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div
          className={cn(
            "mb-8 opacity-0 animate-in fade-in slide-in-from-bottom-4 duration-500",
            isVisible && "opacity-100"
          )}
        >
          <h1 className="text-3xl font-bold mb-2">Shop Pre-Loved Fashion</h1>
          <p className="text-muted-foreground">
            Discover unique, sustainable fashion items listed by our community
          </p>
        </div>

        {/* Filters and Sorting */}
        <div
          className={cn(
            "flex flex-col sm:flex-row gap-4 mb-8 opacity-0 animate-in fade-in slide-in-from-bottom-4 duration-500",
            isVisible && "opacity-100"
          )}
        >
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Search</label>
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search items, brands, locations..."
              aria-label="Search listings"
            />
          </div>
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Category</label>
            <Select
              value={categoryFilter}
              onValueChange={(v) => setCategoryFilter(v)}
              aria-label="Filter by category"
            >
              <SelectTrigger>
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="women">Women's Clothing</SelectItem>
                <SelectItem value="men">Men's Clothing</SelectItem>
                <SelectItem value="kids">Kids' Clothing</SelectItem>
                <SelectItem value="accessories">Accessories</SelectItem>
                <SelectItem value="shoes">Shoes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Price Range</label>
            <Select
              value={priceFilter}
              onValueChange={setPriceFilter}
              aria-label="Filter by price range"
            >
              <SelectTrigger>
                <SelectValue placeholder="All Prices" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Prices</SelectItem>
                <SelectItem value="0-1000">NPR 0 - 1,000</SelectItem>
                <SelectItem value="1000-5000">NPR 1,000 - 5,000</SelectItem>
                <SelectItem value="5000+">NPR 5,000+</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Sort By</label>
            <Select
              value={sortOrder}
              onValueChange={setSortOrder}
              aria-label="Sort by price"
            >
              <SelectTrigger>
                <SelectValue placeholder="Default" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="low-to-high">Price: Low to High</SelectItem>
                <SelectItem value="high-to-low">Price: High to Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Brand</label>
            <Input value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} placeholder="e.g. Zara" aria-label="Filter by brand" />
          </div>
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Condition</label>
            <Select value={conditionFilter} onValueChange={setConditionFilter} aria-label="Filter by condition">
              <SelectTrigger>
                <SelectValue placeholder="All Conditions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Conditions</SelectItem>
                <SelectItem value="excellent">Excellent</SelectItem>
                <SelectItem value="good">Good</SelectItem>
                <SelectItem value="fair">Fair</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Size</label>
            <Input value={sizeFilter} onChange={(e) => setSizeFilter(e.target.value)} placeholder="e.g. M" aria-label="Filter by size" />
          </div>
          <div className="sm:w-56 w-full grid grid-cols-2 gap-4 items-end">
            <label className="text-sm font-medium mb-2 block col-span-2">Quick Filters</label>
            <button
              type="button"
              onClick={() => setOnSaleOnly(v => !v)}
              className={cn(
                "h-10 rounded-md border px-3 text-sm text-left",
                onSaleOnly ? "border-thrift-green bg-thrift-green/10" : "hover:bg-muted/50"
              )}
              aria-pressed={onSaleOnly}
            >
              {onSaleOnly ? "✓ On Sale" : "On Sale"}
            </button>
            <button
              type="button"
              onClick={() => setFeaturedOnly(v => !v)}
              className={cn(
                "h-10 rounded-md border px-3 text-sm text-left",
                featuredOnly ? "border-thrift-green bg-thrift-green/10" : "hover:bg-muted/50"
              )}
              aria-pressed={featuredOnly}
            >
              {featuredOnly ? "✓ Featured" : "Featured"}
            </button>
            <button
              type="button"
              onClick={() => setVerifiedOnly(v => !v)}
              className={cn(
                "h-10 rounded-md border px-3 text-sm text-left col-span-2",
                verifiedOnly ? "border-thrift-green bg-thrift-green/10" : "hover:bg-muted/50"
              )}
              aria-pressed={verifiedOnly}
            >
              {verifiedOnly ? "✓ Trusted Sellers" : "Trusted Sellers"}
            </button>
          </div>
        </div>

        {/* Listings Grid */}
        <div ref={gridRef}>
          {filteredListings.length === 0 ? (
            <div
              className={cn(
                "text-center py-12 text-muted-foreground opacity-0 animate-in fade-in duration-500",
                isVisible && "opacity-100"
              )}
            >
              <p>No items found. Try adjusting your filters or search.</p>
              <Button asChild className="mt-4 bg-thrift-green hover:bg-thrift-green/90">
                <Link to="/shop">Find Other Items</Link>
              </Button>
            </div>
          ) : (
            <div
              className={cn(
                "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 opacity-0 animate-in fade-in slide-in-from-bottom-4 duration-500",
                isVisible && "opacity-100"
              )}
            >
              {filteredListings.map((listing, index) => (
                <Card
                  key={listing.id}
                  className="group cursor-pointer border rounded-lg shadow-sm hover:shadow-lg transition duration-200 hover:-translate-y-1 focus-visible:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-thrift-green"
                  style={{ animationDelay: `${index * 100}ms` }}
                  tabIndex={0}
                  role="link"
                  onClick={() => navigate(`/product/${listing.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`/product/${listing.id}`);
                    }
                  }}
                >
                  <CardContent className="p-4">
                    <div className="relative">
                      <img
                        src={listing.images[0] || "https://via.placeholder.com/150"}
                        alt={listing.title}
                        className="h-48 w-full object-cover rounded-lg mb-4"
                      />
                      {(featuredOnly || isFeatured(listing, index)) && (
                        <span className="absolute top-2 left-2 inline-flex items-center rounded-full bg-thrift-green text-white text-[10px] font-semibold px-2 py-0.5 shadow">
                          Featured
                        </span>
                      )}
                      {isOnSale(listing) && (
                        <span className="absolute top-2 left-24 inline-flex items-center rounded-full bg-rose-500 text-white text-[10px] font-semibold px-2 py-0.5 shadow">
                          On Sale
                        </span>
                      )}
                      <button
                        className={`absolute top-2 right-2 w-9 h-9 rounded-md grid place-items-center bg-white/90 hover:bg-white transition ${wishlistIds.has(String(listing.id)) ? 'text-red-500' : ''}`}
                        onClick={(e) => { e.stopPropagation(); toggleWishlist(String(listing.id)); }}
                        aria-label={wishlistIds.has(String(listing.id)) ? 'Remove from wishlist' : 'Add to wishlist'}
                      >
                        <Heart className={`w-4 h-4 ${wishlistIds.has(String(listing.id)) ? 'fill-current' : ''}`} />
                      </button>
                    </div>
                    <h3 className="text-lg font-semibold mb-2 truncate group-hover:text-thrift-green">
                      {listing.title}
                    </h3>
                    <p className="text-thrift-green font-bold mb-2">
                      NPR {listing.price.toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground mb-1">
                      Condition: {listing.condition}
                    </p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Category: {listing.category}
                    </p>
                    {(() => {
                      const st = String(listing.status || '').toLowerCase();
                      const unavailable = !!st && st !== 'unsold';
                      const showSignIn = !unavailable && !isAuthenticated;
                      const label = unavailable
                        ? (st === 'sold' ? 'Sold' : 'Not available')
                        : showSignIn
                          ? 'Sign in to add'
                          : 'Add to Cart';
                      const onClick = (e: React.MouseEvent) => {
                        e.stopPropagation();
                        if (unavailable) return;
                        if (showSignIn) {
                          const next = encodeURIComponent(location.pathname + location.search);
                          navigate(`/signup?next=${next}`);
                          return;
                        }
                        addToCart(listing);
                      };
                      return (
                        <Button
                          className={`w-full py-2 px-3 text-sm rounded-full shadow-sm transition transform hover:-translate-y-[1px] ${unavailable ? 'cursor-not-allowed bg-gray-200 text-gray-700' : 'bg-thrift-green hover:bg-thrift-green/90 text-white'}`}
                          onClick={onClick}
                          aria-label={label}
                          disabled={unavailable}
                        >
                          <ShoppingCart className="w-4 h-4 mr-2" />
                          {label}
                        </Button>
                      );
                    })()}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
      
    </div>
  );
};

export default Shop;