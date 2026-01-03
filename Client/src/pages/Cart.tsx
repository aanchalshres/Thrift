import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@mui/material";
import { ShoppingBag, Trash2 } from "lucide-react";
import { CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";

export default function Cart() {
  const [cart, setCart] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000";
  const { token, isAuthenticated, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !token) { setCart([]); setLoading(false); return; }
    fetchCart();
  }, [isAuthenticated, token, authLoading]);

  const fetchCart = async () => {
    if (!isAuthenticated || !token) { setCart([]); setLoading(false); return; }

    try {
      const response = await fetch(`${apiBase}/api/cart`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCart(data);
        try {
          window.dispatchEvent(new CustomEvent('cartUpdated', { detail: { count: data.length } }));
        } catch {}
      } else {
        console.error("Failed to fetch cart from database");
        setCart([]);
      }
    } catch (error) {
      console.error("Error fetching cart:", error);
      setCart([]);
    } finally {
      setLoading(false);
    }
  };

  const clearCart = async () => {
    if (isAuthenticated && token) {
      try {
        const response = await fetch(`${apiBase}/api/cart`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        
        if (response.ok) {
          console.log("Cart cleared from database");
        } else {
          const error = await response.json();
          console.error("Failed to clear cart from DB:", error);
        }
      } catch (error) {
        console.error("Error clearing cart:", error);
      }
    } else {
      alert('Please sign in to manage your cart.');
      try { navigate('/signin?next=%2Fcart'); } catch {}
      return;
    }
    
    setCart([]);
    try { window.dispatchEvent(new CustomEvent('cartUpdated', { detail: { count: 0 } })); } catch {}
  };

  const subtotal = cart.reduce((sum, item) => sum + Number(item.price || 0) * (item.quantity || 1), 0);
  const TAX_RATE = Number(import.meta.env.VITE_TAX_RATE ?? 0);
  const taxes = subtotal * TAX_RATE;
  const shipping = cart.length > 0 ? 200 : 0;
  const total = subtotal + taxes + shipping;

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-center">Loading cart...</p>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="bg-card border-none shadow-sm">
          <CardContent className="flex flex-col items-center justify-center p-8 text-center">
            <ShoppingBag className="w-12 h-12 text-thrift-green mb-4" />
            <h2 className="text-xl font-medium text-foreground mb-2">
              Your cart is empty 🛒
            </h2>
            <p className="text-muted-foreground mb-6">
              Looks like you haven't added any items yet.
            </p>
            <Link to="/shop">
              <Button className="bg-thrift-green hover:bg-thrift-green/90 text-white" size="lg">
                Shop Now
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  async function removeItem(id: any): Promise<void> {
    console.log("Attempting to remove item with ID:", id);
    
    if (!isAuthenticated || !token) {
      alert('Please sign in to manage your cart.');
      try { navigate('/signin?next=%2Fcart'); } catch {}
      return;
    }

    try {
      console.log(`Calling DELETE ${apiBase}/api/cart/${id}`);
      const response = await fetch(`${apiBase}/api/cart/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      console.log("Delete response status:", response.status);
      
      if (response.ok) {
        console.log("Successfully removed from DB, refetching cart");
        // Reload entire cart from database
        await fetchCart();
      } else {
        const error = await response.json();
        console.error("Backend delete failed:", error);
        alert(`Failed to remove item: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error("Network error removing from cart:", error);
      alert('Network error - item not removed');
    }
  }

  // Client-side cart UI updates are removed; cart state comes from server only

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 text-center relative">
  <h1 className="text-3xl md:text-4xl font-bold text-[hsl(var(--thrift-green))]">Your Cart</h1>
        <Button
          variant="destructive"
          size="sm"
          onClick={clearCart}
          className="hidden sm:inline-flex absolute right-0 top-1/2 -translate-y-1/2"
          aria-label="Clear cart"
          title="Clear cart"
        >
          <Trash2 className="w-4 h-4 mr-1" />
          Clear Cart
        </Button>
      </div>
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
  <div className="lg:col-span-2 w-full max-w-lg mx-auto">
          {cart.map((item) => (
            <Card key={item.id} className="mb-3 border-none shadow-sm bg-card hover:shadow-md transition-all duration-200">
              <CardContent className="p-3 flex items-center gap-3">
                <img
                  src={item.image || "https://images.unsplash.com/photo-1509281373149-e957c6296406"}
                  alt={item.title}
                  className="w-20 h-24 object-cover rounded-md"
                />
                <div className="flex-1">
                  <h3 className="font-medium text-foreground line-clamp-1">{item.title}</h3>
                  <p className="text-base font-bold text-thrift-green">NPR {Number(item.price || 0).toLocaleString()}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => removeItem(item.id)} className="text-destructive hover:text-destructive/90 hover:bg-destructive/10">
                  <Trash2 className="w-5 h-5" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

  <Card className="bg-thrift-cream border-none shadow-sm h-fit lg:sticky lg:top-6">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-foreground">Order Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium text-foreground">NPR {subtotal.toLocaleString()}</span>
              </div>
              {taxes > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Taxes ({Math.round(TAX_RATE * 100)}%)</span>
                  <span className="font-medium text-foreground">NPR {taxes.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span className="font-medium text-foreground">NPR {shipping.toLocaleString()}</span>
              </div>
              <div className="border-t pt-4">
                <div className="flex justify-between">
                  <span className="font-bold text-foreground">Total</span>
                  <span className="font-bold text-thrift-green">NPR {total.toLocaleString()}</span>
                </div>
              </div>
            </div>
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Link to="/checkout">
                  <Button className="w-full bg-thrift-green hover:bg-thrift-green/90 text-white" size="lg">
                    Proceed to Checkout
                  </Button>
                </Link>
                <Link to="/shop">
                  <Button variant="outline" className="w-full border-thrift-green text-thrift-green hover:bg-thrift-green/10" size="lg">
                    Continue Shopping
                  </Button>
                </Link>
              </div>
              <Button variant="destructive" className="w-full sm:hidden" size="lg" onClick={clearCart}>
                Clear Cart
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};