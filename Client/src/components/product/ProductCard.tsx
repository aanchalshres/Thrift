import { Heart } from "lucide-react";
import { useState, useEffect } from "react";
import { ShoppingBag, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

interface ProductCardProps {
  id: string;
  title: string;
  price: number;
  originalPrice?: number;
  brand: string;
  size: string;
  condition: "Excellent" | "Good" | "Fair";
  images: string[];
  isLiked?: boolean;
  seller: string;
  location: string;
  className?: string;
  status?: string;
  isVerifiedSeller?: boolean;
}

export const ProductCard = ({
  id,
  title,
  price,
  originalPrice,
  brand,
  size,
  condition,
  images,
  isLiked = false,
  seller,
  location,
  className,
  status,
  isVerifiedSeller = false,
}: ProductCardProps) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [liked, setLiked] = useState(isLiked);
  const [cartItems, setCartItems] = useState<number>(0);
  const [isHovered, setIsHovered] = useState(false);
  const auth = useAuth();
  const apiBase = import.meta.env.VITE_API_URL || "https://thrift-production-af9f.up.railway.app";

  // Load cart and wishlist from localStorage on mount
  useEffect(() => {
    // load unified cart (array of item objects)
    const storedCart = JSON.parse(localStorage.getItem("cart") || "[]");
    setCartItems(Array.isArray(storedCart) ? storedCart.length : 0);
    const storedWishlist = JSON.parse(localStorage.getItem("wishlist") || "[]");
    setLiked(storedWishlist.includes(id));
  }, [id]);

  const discountPercentage = originalPrice
    ? Math.round((1 - price / originalPrice) * 100)
    : 0;

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case "Excellent":
        return "bg-success text-success-foreground";
      case "Good":
        return "bg-thrift-green text-white";
      case "Fair":
        return "bg-warning text-warning-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const handleAddToCart = () => {
    // Require auth for adding to cart (redirect suggestion)
    if (!auth?.token) {
      toast.error('Please sign in first', { description: 'Create an account to add items to your cart.' });
      try { window.dispatchEvent(new CustomEvent('authRedirect', { detail: { to: '/signup?next=%2Fshop' } })); } catch {}
      return;
    }
    // Prevent adding items that are not available for sale
    const st = String(status || "").toLowerCase();
    if (st && st !== 'unsold') {
      toast.error("Item cannot be added to cart", { description: `This listing is ${st.replace('_', ' ')}` });
      return;
    }
    const storedCart: Array<any> = JSON.parse(localStorage.getItem("cart") || "[]");
    const idx = storedCart.findIndex((c) => String(c.id) === String(id));
    if (idx >= 0) {
      // already present: don't duplicate for thrift single-quantity
      try { window.dispatchEvent(new CustomEvent("cartUpdated", { detail: { count: storedCart.length } })); } catch {}
      setCartItems(storedCart.length);
      toast.info("Item already in cart", { description: title });
      return;
    }
    storedCart.push({
      id,
      title,
      price,
      image: images && images[0] ? images[0] : "",
      quantity: 1,
    });
    localStorage.setItem("cart", JSON.stringify(storedCart));
    setCartItems(storedCart.length);
    try { window.dispatchEvent(new CustomEvent("cartUpdated", { detail: { count: storedCart.length } })); } catch {}
    toast.success("Added to cart", { description: title });
  };

  const handleToggleWishlist = () => {
    (async () => {
      const storedWishlist = JSON.parse(localStorage.getItem("wishlist") || "[]");
      const pid = String(id);
      // Try server sync when authenticated
      try {
        if (auth && auth.token) {
          if (storedWishlist.includes(pid)) {
            const resp = await fetch(`${apiBase}/api/wishlist/${pid}`, { method: 'DELETE', headers: { Authorization: `Bearer ${auth.token}` } });
            if (!resp.ok) throw new Error('Failed');
            const updated = storedWishlist.filter((itemId: string) => itemId !== pid);
            localStorage.setItem("wishlist", JSON.stringify(updated));
            setLiked(false);
            try { window.dispatchEvent(new CustomEvent('wishlistUpdated', { detail: { count: updated.length } })); } catch {}
            toast('Removed from wishlist');
            return;
          } else {
            const resp = await fetch(`${apiBase}/api/wishlist`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` }, body: JSON.stringify({ productId: pid }) });
            if (!resp.ok) throw new Error('Failed');
            const updated = Array.isArray(storedWishlist) ? [...storedWishlist, pid] : [pid];
            localStorage.setItem("wishlist", JSON.stringify(updated));
            setLiked(true);
            try { window.dispatchEvent(new CustomEvent('wishlistUpdated', { detail: { count: updated.length } })); } catch {}
            toast.success('Added to wishlist');
            return;
          }
        }
      } catch (e) {
        // server sync failed; fall back to local toggle with toast
        console.warn('wishlist sync failed, falling back to local', e && e.message ? e.message : e);
      }

      // Local toggle fallback
      if (storedWishlist.includes(pid)) {
        const updatedWishlist = storedWishlist.filter((itemId: string) => itemId !== pid);
        localStorage.setItem("wishlist", JSON.stringify(updatedWishlist));
        setLiked(false);
        try { window.dispatchEvent(new CustomEvent('wishlistUpdated', { detail: { count: updatedWishlist.length } })); } catch {}
        toast('Removed from wishlist');
      } else {
        const next = Array.isArray(storedWishlist) ? [...storedWishlist, pid] : [pid];
        localStorage.setItem("wishlist", JSON.stringify(next));
        setLiked(true);
        try { window.dispatchEvent(new CustomEvent('wishlistUpdated', { detail: { count: next.length } })); } catch {}
        toast.success('Added to wishlist');
      }
    })();
  };

  return (
    <Card
      className={cn(
        "group overflow-hidden border-none shadow-sm hover:shadow-lg transition-all duration-300 bg-card",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative overflow-hidden bg-thrift-cream">
        {/* Product Image */}
        <div className="aspect-[3/4] overflow-hidden">
          <img
            src={images[currentImageIndex]}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        </div>

        {/* Image Indicators */}
        {images.length > 1 && (
          <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 flex space-x-1">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentImageIndex(index)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  index === currentImageIndex
                    ? "bg-white scale-110"
                    : "bg-white/60 hover:bg-white/80"
                )}
              />
            ))}
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-2">
          <Badge className={getConditionColor(condition)} variant="secondary">
            {condition}
          </Badge>
            {discountPercentage > 0 && (
            <Badge className="bg-thrift-green text-white">
              -{discountPercentage}%
            </Badge>
          )}
        </div>

        {/* Action Buttons */}
        <div
          className={cn(
            "absolute top-3 right-3 flex flex-col gap-2 transition-all duration-300",
            isHovered ? "opacity-100 translate-x-0" : "opacity-0 translate-x-2"
          )}
        >
          <Button
            variant="secondary"
            size="sm"
            className={cn(
              "w-9 h-9 p-0 bg-white/90 hover:bg-white transition-colors",
              liked && "text-red-500 hover:text-red-600"
            )}
            onClick={handleToggleWishlist}
          >
            <Heart className={cn("w-4 h-4", liked && "fill-current")} />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="w-9 h-9 p-0 bg-white/90 hover:bg-white"
          >
            <Eye className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <CardContent className="p-4">
        {/* Brand & Seller */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold italic text-foreground/90 tracking-wide">
            {brand || '\u00A0'}
          </span>
          <span className="text-xs text-muted-foreground">{location}</span>
        </div>

        {/* Title */}
        <h3 className="font-medium text-foreground leading-tight mb-2 line-clamp-2">
          {title}
        </h3>

        {/* Size & Seller */}
        <div className="flex items-center justify-between mb-3">
          <Badge variant="outline" className="text-xs">
            Size {size}
          </Badge>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            by {seller}
            {isVerifiedSeller && (
              <span title="Verified seller" className="inline-flex items-center gap-1 rounded-full bg-thrift-green text-white px-1.5 py-0.5 text-[10px] font-semibold">
                ✓ <span className="hidden sm:inline">Verified</span>
              </span>
            )}
          </span>
        </div>

        {/* Price & Discount */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-thrift-green">
              NPR {price.toLocaleString()}
            </span>
            {originalPrice && (
              <>
                <span className="text-sm text-muted-foreground line-through">
                  NPR {originalPrice.toLocaleString()}
                </span>
                {originalPrice > price && discountPercentage > 0 && (
                  <span className="inline-flex items-center rounded-full bg-thrift-green text-white text-[10px] font-semibold px-2 py-0.5">
                    -{discountPercentage}%
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Add to Cart Button */}
        {
          (() => {
            const st = String(status || "").toLowerCase();
            const disabledStatus = !!st && st !== 'unsold';
            const disabledAuth = !auth?.token;
            const disabled = disabledStatus || disabledAuth;
            const label = disabledStatus
              ? (st === 'sold' ? 'Sold' : 'Not available')
              : (disabledAuth ? 'Sign in to add' : 'Add to Cart');
            return (
              <Button
                className={`w-full py-2 px-3 text-sm rounded-full shadow-sm transition transform hover:-translate-y-[1px] ${disabled ? 'cursor-not-allowed bg-gray-200 text-gray-700' : 'bg-thrift-green hover:bg-thrift-green/90 text-white'}`}
                size="sm"
                onClick={handleAddToCart}
                disabled={disabled}
                aria-disabled={disabled}
              >
                <ShoppingBag className="w-4 h-4 mr-2" />
                {label}
              </Button>
            );
          })()
        }
      </CardContent>
    </Card>
  );
};