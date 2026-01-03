import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { initiateEsewaPayment } from "@/lib/esewa";
import { initiateKhaltiPayment } from "@/lib/khalti";

type CartItem = {
  id: string;
  title: string;
  price: number;
  image: string;
  quantity: number;
};

interface FormData {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  payment: "cod" | "esewa" | "khalti" | "bank";
  bankAccount?: string;
  bankName?: string;
}

export default function Checkout() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { user, token, loading: authLoading } = useAuth();
  const apiBase = import.meta.env.VITE_API_URL || "https://thrift-production-af9f.up.railway.app";

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    setValue,
    watch,
  } = useForm<FormData>({
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      payment: "cod",
      bankAccount: "",
      bankName: "",
    },
    mode: "onChange",
  });

  const paymentMethod = watch("payment");

  // Load cart from server after auth hydration; route is protected
  useEffect(() => {
    if (authLoading) return;
    if (!token) { setCartItems([]); return; }
    (async () => {
      try {
        const resp = await fetch(`${apiBase.replace(/\/$/, '')}/api/cart`, { headers: { Authorization: `Bearer ${token}` } });
        if (resp.ok) {
          const data = await resp.json();
          setCartItems(Array.isArray(data) ? data : []);
        } else {
          setCartItems([]);
        }
      } catch {
        setCartItems([]);
      }
    })();
  }, [token, apiBase, authLoading]);

  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-gray-700">
          <span className="inline-block w-4 h-4 rounded-full border-2 border-slate-600 border-t-transparent animate-spin" />
          <span>Preparing checkout…</span>
        </div>
      </div>
    );
  }

  const subtotal = cartItems.reduce((sum, item) => sum + Number(item.price || 0), 0);
  const TAX_RATE = Number(import.meta.env.VITE_TAX_RATE ?? 0);
  const taxes = subtotal * TAX_RATE;
  const shipping = cartItems.length > 0 ? 200 : 0;
  const total = subtotal + taxes + shipping;

  const simulateBankPayment = async (data: FormData) =>
    new Promise((resolve, reject) =>
      setTimeout(
        () =>
          Math.random() > 0.1 && data.bankAccount && data.bankName
            ? resolve({ success: true })
            : reject(new Error("Bank failed")),
        1500
      )
    );

  const simulateCOD = async () => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 800));

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const genIdempotencyKey = () => `idemp-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
      const idempotency_key = genIdempotencyKey();
      if (data.payment === "esewa") {
        toast("Redirecting to eSewa…");
        // Create a pending order first so we can map it to the eSewa transaction
        const orderPayload = {
          userId: user?.id ?? null,
          items: cartItems.map((i) => ({ productId: i.id, title: i.title, price: i.price, image: i.image })),
          subtotal: Math.round(subtotal),
          tax: Math.round(taxes),
          shipping: Math.round(shipping),
          total: Math.round(total),
          paymentMethod: "esewa",
          paymentStatus: "pending",
          idempotency_key,
          shippingAddress: { name: data.name, phone: data.phone, address: data.address, city: data.city },
        };
        const createRes = await fetch(`${apiBase}/api/orders`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(orderPayload),
        });
        if (!createRes.ok) {
          const text = await createRes.text();
          throw new Error(`Order creation failed: ${createRes.status} - ${text}`);
        }
        const created = await createRes.json();
        const newOrderId = created.insertId || created.id || created.orderId;

        await initiateEsewaPayment(
          apiBase,
          {
            amount: Math.round(total),
            productName: cartItems[0]?.title ? `Order - ${cartItems[0].title}` : "Order Payment",
            transactionId: `txn-${Date.now()}`,
            orderId: newOrderId,
          },
          token || undefined
        );
        return; // The browser will redirect to eSewa on success
      } else if (data.payment === "khalti") {
        toast("Redirecting to Khalti…");
        const orderPayload = {
          userId: user?.id ?? null,
          items: cartItems.map((i) => ({ productId: i.id, title: i.title, price: i.price, image: i.image })),
          subtotal: Math.round(subtotal),
          tax: Math.round(taxes),
          shipping: Math.round(shipping),
          total: Math.round(total),
          paymentMethod: "khalti",
          paymentStatus: "pending",
          idempotency_key,
          shippingAddress: { name: data.name, phone: data.phone, address: data.address, city: data.city },
        };
        const createRes = await fetch(`${apiBase}/api/orders`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(orderPayload),
        });
        if (!createRes.ok) {
          const text = await createRes.text();
          throw new Error(`Order creation failed: ${createRes.status} - ${text}`);
        }
        const created = await createRes.json();
        const newOrderId = created.insertId || created.id || created.orderId;

        await initiateKhaltiPayment(
          apiBase,
          {
            amount: Math.round(total),
            productName: cartItems[0]?.title ? `Order - ${cartItems[0].title}` : "Order Payment",
            orderId: newOrderId,
          },
          token || undefined
        );
        return;
      } else if (data.payment === "bank") await simulateBankPayment(data);
      else await simulateCOD();

      const payload = {
        userId: user?.id ?? null,
  items: cartItems.map((i) => ({ productId: i.id, title: i.title, price: i.price, image: i.image })),
        subtotal: Math.round(subtotal),
        tax: Math.round(taxes),
        shipping: Math.round(shipping),
        total: Math.round(total),
        paymentMethod: data.payment,
        paymentStatus: data.payment === "cod" ? "pending" : "paid",
        idempotency_key,
        shippingAddress: { name: data.name, phone: data.phone, address: data.address, city: data.city },
      };

      const resp = await fetch(`${apiBase}/api/orders`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const text = await resp.text();
        console.error("Order save failed:", resp.status, text);
        throw new Error(`Order save failed: ${resp.status} - ${text}`);
      }

      const created = await resp.json();

      // Clear server cart (COD/Bank flows) and show confirmation
      try {
        if (token) {
          await fetch(`${apiBase}/api/cart`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
        }
      } catch {}
      try { window.dispatchEvent(new CustomEvent('cartUpdated', { detail: { count: 0 } })); } catch {}
      setCartItems([]);
      // Emit a lightweight event so Profile can refresh immediately
      try {
        const newOrderId = created.insertId || created.id || created.orderId;
        window.dispatchEvent(new CustomEvent('orderPlaced', { detail: { id: newOrderId, total, items: payload.items } }));
      } catch {}
      toast.success("Order placed successfully", {
        description: `Order ID: ${created.insertId || created.id || created.orderId || "N/A"}`,
      });
      // Navigate home (SPA) so the toast remains visible
      navigate("/");
    } catch (e) {
      console.error(e);
      toast.error("Payment or save failed", {
        description: "Please try again or check the console for details.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (cartItems.length === 0) {
    return (
      <div className="flex flex-col min-h-screen bg-thrift-cream">
        <div className="container mx-auto px-4 py-16 flex-grow">
          <Alert className="max-w-md mx-auto border-thrift-warm/20">
            <AlertDescription className="text-center">
              Your cart is empty.{" "}
              <a href="/shop" className="text-thrift-green hover:underline">
                Browse products
              </a>{" "}
              to start shopping.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-thrift-cream">
      <section className="py-16 flex-grow">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl md:text-4xl font-bold text-center mb-12 text-thrift-green">Checkout</h1>
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 border-none shadow-sm bg-card">
              <CardHeader>
                <CardTitle className="text-2xl font-bold text-thrift-green">Shipping & Payment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Reserve space so the card doesn't jump when payment sections expand/collapse */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name" className="text-black">Full Name</Label>
                    <Input id="name" {...register("name", { required: "Name is required" })} className={errors.name ? "border-thrift-warm" : ""} />
                    {errors.name && <p className="text-sm text-thrift-warm mt-1">{errors.name.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="email" className="text-black">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      {...register("email", {
                        required: "Email is required",
                        pattern: { value: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, message: "Invalid email" },
                      })}
                      className={errors.email ? "border-thrift-warm" : ""}
                    />
                    {errors.email && <p className="text-sm text-thrift-warm mt-1">{errors.email.message}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="phone" className="text-black">Phone</Label>
                    <Input
                      id="phone"
                      {...register("phone", {
                        required: "Phone is required",
                        pattern: { value: /^\+?\d{10,15}$/, message: "Invalid phone number" },
                      })}
                      className={errors.phone ? "border-thrift-warm" : ""}
                    />
                    {errors.phone && <p className="text-sm text-thrift-warm mt-1">{errors.phone.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="city" className="text-black">City</Label>
                    <Input id="city" {...register("city", { required: "City is required" })} className={errors.city ? "border-thrift-warm" : ""} />
                    {errors.city && <p className="text-sm text-thrift-warm mt-1">{errors.city.message}</p>}
                  </div>
                </div>
                <div>
                  <Label htmlFor="address" className="text-black">Address</Label>
                  <Input id="address" {...register("address", { required: "Address is required" })} className={errors.address ? "border-thrift-warm" : ""} />
                  {errors.address && <p className="text-sm text-thrift-warm mt-1">{errors.address.message}</p>}
                </div>
                <div>
                  <Label className="text-black">Payment Method</Label>
                  <RadioGroup defaultValue="cod" onValueChange={(v) => setValue("payment", v as any)} className="flex gap-6 mt-2 flex-wrap">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="cod" id="cod" />
                      <Label htmlFor="cod" className="text-foreground">Cash on Delivery</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="esewa" id="esewa" />
                      <Label htmlFor="esewa" className="text-foreground">eSewa</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="khalti" id="khalti" />
                      <Label htmlFor="khalti" className="text-foreground">Khalti</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="bank" id="bank" />
                      <Label htmlFor="bank" className="text-foreground">Bank Account</Label>
                    </div>
                  </RadioGroup>
                </div>
                {/* Payment details area sized by its own content */}
                <div className="space-y-6">
                {paymentMethod === "bank" && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="bankName" className="text-black">Bank Name</Label>
                        <Input id="bankName" {...register("bankName", { required: "Bank name is required" })} className={errors.bankName ? "border-thrift-warm" : ""} />
                        {errors.bankName && <p className="text-sm text-thrift-warm mt-1">{errors.bankName.message}</p>}
                      </div>
                      <div>
                        <Label htmlFor="bankAccount" className="text-black">Account Number</Label>
                        <Input
                          id="bankAccount"
                          {...register("bankAccount", {
                            required: "Account number is required",
                            pattern: { value: /^\d{10,20}$/, message: "Invalid account number" },
                          })}
                          className={errors.bankAccount ? "border-thrift-warm" : ""}
                        />
                        {errors.bankAccount && <p className="text-sm text-thrift-warm mt-1">{errors.bankAccount.message}</p>}
                      </div>
                    </div>
                    <div>
                      <Label className="text-black">Scan QR Code for Bank Payment</Label>
                      <div className="mt-2">
                        <img src="/images/bank.jpg" alt="Bank QR Code" className="w-32 h-32 mx-auto border border-thrift-warm/20" />
                        <p className="text-sm text-muted-foreground mt-2 text-center">Scan this QR code to make a payment to our bank account.</p>
                      </div>
                    </div>
                  </div>
                )}
                {paymentMethod === "esewa" && (
                  <div className="text-center text-sm text-muted-foreground">
                    You will be redirected to eSewa after you place the order.
                  </div>
                )}
                {paymentMethod === "khalti" && (
                  <div className="text-center text-sm text-muted-foreground">
                    You will be redirected to Khalti to complete your payment securely.
                  </div>
                )}
                </div>
                <Button
                  type="submit"
                  className="w-full bg-thrift-green hover:bg-thrift-green/90 text-white text-lg py-6"
                  disabled={!isValid || isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      {paymentMethod === 'esewa' || paymentMethod === 'khalti' ? 'Redirecting…' : 'Placing Order...'}
                    </>
                  ) : (
                    paymentMethod === 'esewa' ? 'Pay with eSewa' : paymentMethod === 'khalti' ? 'Pay with Khalti' : 'Place Order'
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-[hsl(var(--thrift-green))]/10 self-start h-auto">
              <CardHeader>
                <CardTitle className="text-2xl font-bold text-thrift-green">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm border-b py-2">
                    <div>
                      <p className="font-medium">{item.title}</p>
                    </div>
                    <p className="font-medium">NPR {Number(item.price || 0).toLocaleString()}</p>
                  </div>
                ))}
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>NPR {subtotal.toLocaleString()}</span>
                  </div>
                  {taxes > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Taxes ({Math.round(TAX_RATE * 100)}%)</span>
                      <span>NPR {taxes.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Shipping</span>
                    <span>NPR {shipping.toLocaleString()}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-bold">
                    <span>Total</span>
                    <span className="text-thrift-green">NPR {total.toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </form>
        </div>
      </section>
    </div>
  );
};