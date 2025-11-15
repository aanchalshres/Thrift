import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, ShoppingBag, User, Heart, Menu, X, MessageSquare, Bell } from "lucide-react";
import { useAuth } from "@/context/AuthContext"; 
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [cartCount, setCartCount] = useState<number>(0);
  const { isAuthenticated, user, token, logout } = useAuth(); // include token
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const apiBase = useMemo(() => import.meta.env.VITE_API_URL || 'https://thrift-production-af9f.up.railway.app', []);

  // notifications state
  const [notifications, setNotifications] = useState<any[]>([]);
  const unreadCount = useMemo(() => notifications.filter(n => !n.read_at).length, [notifications]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState<string | null>(null);
  const [sse, setSse] = useState<EventSource | null>(null);

  const loadNotifications = async () => {
    if (!isAuthenticated || !token) return;
    setNotifLoading(true);
    setNotifError(null);
    try {
      const resp = await fetch(`${apiBase}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error('Failed to fetch notifications');
      const data = await resp.json();
      setNotifications(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setNotifError(e?.message || 'Failed to fetch notifications');
    } finally {
      setNotifLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
    // optional: refresh periodically
    const id = setInterval(() => { loadNotifications(); }, 60000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, token, apiBase]);

  // Cart count: initialize only when authenticated; reset to 0 when logged out
  useEffect(() => {
    const compute = (): number => {
      if (!isAuthenticated) return 0; // hide count when not logged in
      try {
        const cart = JSON.parse(localStorage.getItem('cart') || '[]');
        if (!Array.isArray(cart)) return 0;
        return cart.reduce((sum: number, item: any) => sum + (Number(item?.quantity ?? 1) || 1), 0);
      } catch { return 0; }
    };
    setCartCount(compute());
    const onStorage = (e: StorageEvent) => { if (e.key === 'cart') setCartCount(compute()); };
    const onCartUpdated = (e: Event) => {
      const ev = e as CustomEvent<{ count?: number }>;
      if (!isAuthenticated) { setCartCount(0); return; }
      if (typeof ev.detail?.count === 'number') setCartCount(ev.detail.count); else setCartCount(compute());
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('cartUpdated', onCartUpdated as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('cartUpdated', onCartUpdated as EventListener);
    };
  }, [isAuthenticated]);

  // Real-time notifications via SSE
  useEffect(() => {
    if (!isAuthenticated || !token) {
      if (sse) { try { sse.close(); } catch {} setSse(null); }
      return;
    }
    // Close previous if any
    if (sse) { try { sse.close(); } catch {} }
    const es = new EventSource(`${apiBase}/api/notifications/stream?token=${encodeURIComponent(token)}`);
    es.addEventListener('notification', (evt: MessageEvent) => {
      try {
        const n = JSON.parse(evt.data);
        // Prepend new notification, limit to 50
        setNotifications(prev => [n, ...prev].slice(0, 50));
      } catch {}
    });
    es.addEventListener('bootstrap', (evt: MessageEvent) => {
      try {
        const list = JSON.parse(evt.data);
        if (Array.isArray(list)) setNotifications(list);
      } catch {}
    });
    es.onerror = () => {
      // auto-close on error; will retry on next effect or via poll
      try { es.close(); } catch {}
    };
    setSse(es);
    return () => { try { es.close(); } catch {}; setSse(null); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, token, apiBase]);

  const markAllRead = async () => {
    const ids = notifications.filter(n => !n.read_at).map(n => n.id);
    if (ids.length === 0) return;
    try {
      await fetch(`${apiBase}/api/notifications/mark-read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ids }),
      });
      // update local state
      setNotifications(prev => prev.map(n => ids.includes(n.id) ? { ...n, read_at: new Date().toISOString() } : n));
    } catch (e) {
      // ignore non-critical errors
    }
  };

  const publicAllowed = new Set(["/", "/about", "/contact"]);
  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/shop", label: "Shop" },
    { href: "/sell", label: "Sell" },
    { href: "/donate", label: "Donate" },
    { href: "/about", label: "About" },
  ];

  const resolveHref = (href: string) => {
    if (isAuthenticated || publicAllowed.has(href)) return href;
    const next = href === '/shop' ? '/shop' : href;
    return `/signup?next=${encodeURIComponent(next)}`;
  };

  const handleLogout = () => {
    logout();
    navigate("/signin");
  };
  
  return (
    <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2 group">
            <img
              src="/images/logo.png"
              alt="ThriftSy Logo"
              className="h-16 w-auto group-hover:scale-110 transition-transform"
            />
          </Link>

          {/* Desktop Search */}
          <div className="hidden md:flex flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search sustainable fashion..."
                className="pl-10 bg-thrift-cream border-none focus:ring-2 focus:ring-thrift-green-light"
              />
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            {navLinks.map((link) => {
              const resolved = resolveHref(link.href);
              const to = resolved === '/shop' ? '/shop?reset=1' : resolved;
              const isActive = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  to={to}
                  className={`${isActive ? 'text-thrift-green' : 'text-foreground'} hover:text-thrift-green transition-colors font-medium`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center space-x-3">
            {isAuthenticated && String(user?.role || '').toLowerCase() === 'admin' && (
              <Button asChild variant="ghost" size="sm" className={`${pathname.startsWith('/admin') ? 'text-thrift-green' : ''} hover:bg-transparent hover:text-thrift-green`}>
                <Link to="/admin">Admin</Link>
              </Button>
            )}
            <Button asChild variant="ghost" size="sm" className="hover:bg-[hsl(var(--thrift-green))]/10 hover:text-[hsl(var(--thrift-green))]">
              <Link to={resolveHref("/wishlist")}>
                <Heart className="w-5 h-5" />
              </Link>
            </Button>
            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="relative hover:bg-[hsl(var(--thrift-green))]/10 hover:text-[hsl(var(--thrift-green))]" onClick={() => { if (!notifications.length) loadNotifications(); }}>
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <Badge className="absolute -top-2 -right-2 w-5 h-5 p-0 bg-thrift-green text-[10px] leading-none rounded-full grid place-items-center">
                      {unreadCount}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="flex items-center justify-between">
                  <span>Notifications</span>
                  {unreadCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={markAllRead}>Mark all read</Button>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {notifLoading && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">Loading…</div>
                )}
                {notifError && (
                  <div className="px-3 py-2 text-sm text-destructive">{notifError}</div>
                )}
                {!notifLoading && !notifError && notifications.length === 0 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">No notifications</div>
                )}
                {!notifLoading && !notifError && notifications.slice(0, 10).map((n) => {
                  let data: any = {};
                  try { data = n.payload ? JSON.parse(n.payload) : {}; } catch {}
                  const title = data?.title || 'Update';
                  const preview = data?.preview || '';
                  const productId = data?.productId;
                  const isUnread = !n.read_at;
                  return (
                    <DropdownMenuItem
                      key={n.id}
                      className={`flex items-start gap-2 ${isUnread ? 'bg-[hsl(var(--thrift-green))]/10' : ''} hover:bg-[hsl(var(--thrift-green))]/10 hover:text-[hsl(var(--thrift-green))] data-[highlighted]:bg-[hsl(var(--thrift-green))]/10 data-[highlighted]:text-[hsl(var(--thrift-green))]`}
                      onClick={async () => {
                        if (isUnread) {
                          setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x));
                          try {
                            await fetch(`${apiBase}/api/notifications/mark-read`, {
                              method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ ids: [n.id] })
                            });
                          } catch {}
                        }
                        if (n.type === 'message') {
                          navigate('/messages');
                        } else if (productId) {
                          navigate(`/product/${productId}`);
                        }
                      }}
                    >
                      <div className="flex-1">
                        <div className="text-sm font-medium truncate">{title}</div>
                        {preview && <div className="text-xs text-muted-foreground truncate">{preview}</div>}
                        <div className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</div>
                      </div>
                      {isUnread && <span className="mt-1 inline-block h-2 w-2 rounded-full bg-thrift-green" />}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button asChild variant="ghost" size="sm" className="hover:bg-[hsl(var(--thrift-green))]/10 hover:text-[hsl(var(--thrift-green))]">
              <Link to={resolveHref("/messages")}>
                <MessageSquare className="w-5 h-5" />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="relative hover:bg-[hsl(var(--thrift-green))]/10 hover:text-[hsl(var(--thrift-green))]">
              <Link to={resolveHref("/cart")}>
                <ShoppingBag className="w-5 h-5" />
                {isAuthenticated && cartCount > 0 && (
                  <Badge className="absolute -top-2 -right-2 w-5 h-5 p-0 bg-thrift-green text-[10px] leading-none rounded-full grid place-items-center">
                    {cartCount}
                  </Badge>
                )}
              </Link>
            </Button>

            {isAuthenticated ? (
              <>
                <Button asChild variant="ghost" size="sm" className="hover:bg-[hsl(var(--thrift-green))]/10 hover:text-[hsl(var(--thrift-green))]">
                  <Link to="/profile" className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    <span className="text-sm font-medium hidden lg:inline">{user?.name}</span>
                  </Link>
                </Button>
                {/** My Listings link moved under Sell page; removed from navbar. */}
                <Button onClick={handleLogout} variant="outline" size="sm" className="hover:bg-[hsl(var(--thrift-green))]/10 hover:text-[hsl(var(--thrift-green))]">
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="hover:bg-[hsl(var(--thrift-green))]/10 hover:text-[hsl(var(--thrift-green))]">
                  <Link to="/signin">{/* fixed casing */}
                    Sign In
                  </Link>
                </Button>
                <Button asChild size="sm" className="bg-thrift-green hover:bg-thrift-green/90">
                  <Link to="/signup">Sign Up</Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Search */}
        <div className="md:hidden pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search sustainable fashion..."
              className="pl-10 bg-thrift-cream border-none"
            />
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden border-t bg-background/95 backdrop-blur">
            <div className="py-4 space-y-2">
              {navLinks.map((link) => {
                const resolved = resolveHref(link.href);
                const to = resolved === '/shop' ? '/shop?reset=1' : resolved;
                const isActive = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    to={to}
                    className={`block px-4 py-2 rounded-md transition-colors ${isActive ? 'text-thrift-green bg-[hsl(var(--thrift-green))]/10' : 'text-foreground hover:bg-[hsl(var(--thrift-green))]/10 hover:text-[hsl(var(--thrift-green))]'}`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                );
              })}
              {isAuthenticated && String(user?.role || '').toLowerCase() === 'admin' && (
                <Link
                  to="/admin"
                  className={`block px-4 py-2 rounded-md transition-colors ${pathname.startsWith('/admin') ? 'text-thrift-green bg-[hsl(var(--thrift-green))]/10' : 'text-foreground hover:bg-[hsl(var(--thrift-green))]/10 hover:text-[hsl(var(--thrift-green))]'}`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  Admin
                </Link>
              )}
              <div className="flex items-center justify-around pt-4 border-t">
                <Button asChild variant="ghost" size="sm" className="hover:bg-[hsl(var(--thrift-green))]/10 hover:text-[hsl(var(--thrift-green))]">
                  <Link to={resolveHref("/wishlist")}>
                    <Heart className="w-5 h-5 mr-2" />
                    Wishlist
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="sm" className="hover:bg-[hsl(var(--thrift-green))]/10 hover:text-[hsl(var(--thrift-green))]">
                  <Link to={resolveHref("/messages")}>
                    <MessageSquare className="w-5 h-5 mr-2" />
                    Messages
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="sm" className="relative hover:bg-[hsl(var(--thrift-green))]/10 hover:text-[hsl(var(--thrift-green))]">
                  <Link to={resolveHref("/cart")}>
                    <ShoppingBag className="w-5 h-5 mr-2" />
                    Cart
                    {isAuthenticated && cartCount > 0 && (
                      <Badge className="ml-2 w-5 h-5 p-0 bg-thrift-green text-[10px] leading-none rounded-full grid place-items-center">
                        {cartCount}
                      </Badge>
                    )}
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="sm" className="hover:bg-[hsl(var(--thrift-green))]/10 hover:text-[hsl(var(--thrift-green))]">
                  <Link to={resolveHref("/profile")}>
                    <User className="w-5 h-5 mr-2" />
                    Profile
                  </Link>
                </Button>
              </div>

              {isAuthenticated ? (
                <div className="pt-2 px-4">
                  <Button onClick={handleLogout} className="w-full hover:bg-[hsl(var(--thrift-green))]/10 hover:text-[hsl(var(--thrift-green))]" variant="outline" size="sm">
                    Logout
                  </Button>
                </div>
              ) : (
                <div className="pt-2 px-4 grid grid-cols-2 gap-2">
                  <Button asChild variant="outline" size="sm" className="hover:bg-[hsl(var(--thrift-green))]/10 hover:text-[hsl(var(--thrift-green))] border-thrift-green">
                    <Link to="/signin">Sign In</Link>
                  </Button>
                  <Button asChild size="sm" className="bg-thrift-green hover:bg-thrift-green/90">
                    <Link to="/signup">Sign Up</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};
