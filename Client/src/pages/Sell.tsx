import React, { useState, useEffect, ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Upload, X, Plus, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const Sell = () => {
  const [images, setImages] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [condition, setCondition] = useState('');
  const [size, setSize] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [description, setDescription] = useState('');
  const [brand, setBrand] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [location, setLocation] = useState('');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isVisible, setIsVisible] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const formRef = React.useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const apiBase = import.meta.env.VITE_API_URL || 'https://thrift-production-af9f.up.railway.app';

  // My Orders state
  const [showMyOrders, setShowMyOrders] = useState(false);
  const [myOrders, setMyOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

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

    if (formRef.current) {
      observer.observe(formRef.current);
    }

    return () => {
      if (formRef.current) {
        observer.unobserve(formRef.current);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      images.forEach((src) => {
        try { URL.revokeObjectURL(src); } catch {}
      });
    };
  }, [images]);

  // Fetch seller orders
  useEffect(() => {
    if (showMyOrders && token) {
      fetchMyOrders();
    }
  }, [showMyOrders, token]);

  const fetchMyOrders = async () => {
    if (!token) return;
    setOrdersLoading(true);
    try {
      const resp = await fetch(`${apiBase}/api/orders/sold`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        setMyOrders(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Failed to fetch orders:', e);
    } finally {
      setOrdersLoading(false);
    }
  };

  function addFiles(newFiles: File[]) {
    if (!Array.isArray(newFiles) || newFiles.length === 0) return;
    const max = 8;
    setFiles((prevFiles) => {
      const allowed = newFiles.slice(0, Math.max(0, max - prevFiles.length));
      return [...prevFiles, ...allowed];
    });
    setImages((prev) => {
      const allowed = newFiles.slice(0, Math.max(0, max - prev.length));
      const previews = allowed.map((f) => URL.createObjectURL(f));
      return [...prev, ...previews];
    });
  }

  function handleImageUpload(event: ChangeEvent<HTMLInputElement>): void {
    const inputFiles = Array.from(event.target.files || []);
    if (inputFiles.length === 0) return;
    addFiles(inputFiles);
    // reset input so same file can be re-selected if needed
    if (event.target) (event.target as HTMLInputElement).value = '';
  }
  

  function removeImage(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setImages((prev) => {
      const next = [...prev];
      const removed = next.splice(index, 1);
      try { if (removed[0] && removed[0].startsWith('blob:')) URL.revokeObjectURL(removed[0]); } catch {}
      return next;
    });
  }

  function validateForm() {
    const newErrors: { [key: string]: string } = {};
    if (images.length === 0) newErrors.images = 'Please upload at least one image';
    if (!title.trim()) newErrors.title = 'Title is required';
    if (!description.trim()) newErrors.description = 'Description is required';
    if (!category) newErrors.category = 'Category is required';
    if (!condition) newErrors.condition = 'Condition is required';
    if (!size) newErrors.size = 'Size is required';
    if (!price || parseFloat(price) <= 0) newErrors.price = 'Valid price is required';
    if (!location.trim()) newErrors.location = 'Location is required';
    return newErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Sell submit triggered');
    setSubmitting(true);
    setErrors({});
    setSubmissionStatus('idle');

    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      console.warn('validation failed', newErrors);
      setErrors(newErrors);
      setSubmissionStatus('error');
      setSubmitting(false);
      return;
    }

  const fd = new FormData();
    fd.append('title', title);
    fd.append('price', String(parseFloat(price) || 0));
    if (originalPrice) fd.append('originalPrice', String(parseFloat(originalPrice)));
  if (brand) fd.append('brand', brand);
  if (category) fd.append('category', category);
    if (size) fd.append('size', size);
    if (condition) fd.append('productCondition', condition); 
    if (location) fd.append('location', location);
    files.forEach((f) => fd.append('images', f));

    try {
      const resp = await fetch(`${apiBase}/api/products`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd,
      });
      const text = await resp.text();
      console.log('server response:', resp.status, text);
      if (!resp.ok) {
        alert('Server error creating product: ' + text);
        // fallback save locally
        const existing = JSON.parse(localStorage.getItem('listings') || '[]');
        localStorage.setItem('listings', JSON.stringify([{ id: Date.now().toString(), title, price, images }, ...existing]));
        return;
      }
      const json = text ? JSON.parse(text) : {};
      toast.success('Item listed successfully', { description: `ID: ${json.id || 'unknown'}` });
      setTitle(''); setPrice(''); setFiles([]); setImages([]);
      navigate('/shop');
    } catch (err) {
      console.error('submit error', err);
      toast.error('Listing failed, saved locally for now');
      const existing = JSON.parse(localStorage.getItem('listings') || '[]');
      localStorage.setItem('listings', JSON.stringify([{ id: Date.now().toString(), title, price, images }, ...existing]));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      
      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className={cn(
          "mb-8 opacity-0 animate-in fade-in slide-in-from-bottom-4 duration-500",
          isVisible && "opacity-100"
        )}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">Sell Your Item</h1>
              <p className="text-muted-foreground">
                List your pre-loved fashion items for sale in just a few steps
              </p>
            </div>
            {token && (
              <div className="pt-1 flex gap-2">
                <Button asChild variant="outline" className="hover:bg-[hsl(var(--thrift-green))]/10">
                  <Link to="/my-listings">My Listings</Link>
                </Button>
                <Button 
                  variant="outline" 
                  className="hover:bg-[hsl(var(--thrift-green))]/10"
                  onClick={() => setShowMyOrders(!showMyOrders)}
                >
                  <Package className="w-4 h-4 mr-2" />
                  {showMyOrders ? 'Hide' : 'My Orders'}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* My Orders Section */}
        {showMyOrders && token && (
          <div className="bg-card rounded-lg border p-6 animate-in fade-in slide-in-from-top-4 duration-300">
            <h2 className="text-xl font-semibold mb-4">My Sales Orders</h2>
            {ordersLoading ? (
              <p className="text-muted-foreground">Loading orders...</p>
            ) : myOrders.length === 0 ? (
              <p className="text-muted-foreground">No orders yet. Your sales will appear here.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Buyer</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myOrders.map((order) => {
                      const total = (order.items || []).reduce((sum: number, item: any) => sum + (Number(item.price) || 0), 0);
                      return (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">#{order.id}</TableCell>
                          <TableCell>{order.buyer_name || 'Anonymous'}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {(order.items || []).map((item: any, idx: number) => (
                                <div key={idx}>{item.title}</div>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(order.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right font-medium">Rs. {total}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8" ref={formRef}>
          {/* Main Form */}
          <div className="lg:col-span-2">
            <form
              onSubmit={handleSubmit}
              noValidate
              className={cn(
                "bg-card rounded-lg border p-6 space-y-6",
                "opacity-0 animate-in fade-in slide-in-from-bottom-4 duration-500",
                isVisible && "opacity-100"
              )}
            >
              {/* Submission Status */}
              {submissionStatus === "success" && (
                <div className="bg-thrift-green/10 text-thrift-green p-4 rounded-lg animate-in fade-in duration-500">
                  Item successfully listed for sale!
                </div>
              )}
              {submissionStatus === "error" && (
                <div className="bg-thrift-green/10 text-thrift-green p-4 rounded-lg animate-in fade-in duration-500">
                  Please fix the errors below and try again.
                </div>
              )}

              {/* Image Upload Section */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Item Images</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-4">
                  {images.map((img, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={img}
                        alt={`Preview ${index + 1}`}
                        className="h-32 w-full object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label={`Remove image ${index + 1}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <label
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (!isDragging) setIsDragging(true); }}
                    onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                    onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
                    onDrop={(e) => {
                      e.preventDefault(); e.stopPropagation(); setIsDragging(false);
                      const dt = e.dataTransfer;
                      if (!dt) return;
                      const dropped = Array.from(dt.files || []).filter(f => f.type.startsWith('image/'));
                      addFiles(dropped);
                    }}
                    className={cn(
                      "flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors",
                      isDragging ? "border-thrift-green bg-thrift-green/5" : "border-muted-foreground/25 hover:border-primary"
                    )}
                    title="Click or drag & drop images"
                  >
                    <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">Click or drag & drop</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      aria-label="Upload item images"
                    />
                  </label>
                </div>
                {errors.images && (
                  <p className="text-sm text-destructive">{errors.images}</p>
                )}
                <p className="text-sm text-muted-foreground">
                  Add up to 8 photos. Drag & drop supported. Include different angles and close-ups of any details or flaws.
                </p>
              </div>

              {/* Basic Information */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Title</label>
                    <Input
                      placeholder="e.g., Vintage Denim Jacket with Embroidered Details"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                      aria-invalid={!!errors.title}
                      aria-describedby={errors.title ? "title-error" : undefined}
                    />
                    {errors.title && (
                      <p className="text-sm text-destructive" id="title-error">
                        {errors.title}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Description</label>
                    <Textarea
                      placeholder="Describe your item in detail..."
                      rows={4}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      required
                      aria-invalid={!!errors.description}
                      aria-describedby={errors.description ? "description-error" : undefined}
                    />
                    {errors.description && (
                      <p className="text-sm text-destructive" id="description-error">
                        {errors.description}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Category</label>
                      <Select
                        value={category}
                        onValueChange={setCategory}
                        required
                        aria-invalid={!!errors.category}
                        aria-describedby={errors.category ? "category-error" : undefined}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="women">Women's Clothing</SelectItem>
                          <SelectItem value="men">Men's Clothing</SelectItem>
                          <SelectItem value="kids">Kids' Clothing</SelectItem>
                          <SelectItem value="accessories">Accessories</SelectItem>
                          <SelectItem value="shoes">Shoes</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.category && (
                        <p className="text-sm text-destructive" id="category-error">
                          {errors.category}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Brand</label>
                      <Input
                        placeholder="Brand name"
                        value={brand}
                        onChange={(e) => setBrand(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Details */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Condition</label>
                    <Select
                      value={condition}
                      onValueChange={setCondition}
                      required
                      aria-invalid={!!errors.condition}
                      aria-describedby={errors.condition ? "condition-error" : undefined}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select condition" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New with tags</SelectItem>
                        <SelectItem value="excellent">Excellent</SelectItem>
                        <SelectItem value="good">Good</SelectItem>
                        <SelectItem value="fair">Fair</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.condition && (
                      <p className="text-sm text-destructive" id="condition-error">
                        {errors.condition}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Size</label>
                    <Select
                      value={size}
                      onValueChange={setSize}
                      required
                      aria-invalid={!!errors.size}
                      aria-describedby={errors.size ? "size-error" : undefined}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select size" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="xs">XS</SelectItem>
                        <SelectItem value="s">S</SelectItem>
                        <SelectItem value="m">M</SelectItem>
                        <SelectItem value="l">L</SelectItem>
                        <SelectItem value="xl">XL</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.size && (
                      <p className="text-sm text-destructive" id="size-error">
                        {errors.size}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Pricing */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Pricing</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Price (NPR)</label>
                    <Input
                      type="number"
                      placeholder="2500"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      required
                      aria-invalid={!!errors.price}
                      aria-describedby={errors.price ? "price-error" : undefined}
                    />
                    {errors.price && (
                      <p className="text-sm text-destructive" id="price-error">
                        {errors.price}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Original Price (NPR)</label>
                    <Input
                      type="number"
                      placeholder="4000"
                      value={originalPrice}
                      onChange={(e) => setOriginalPrice(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Location */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Location</h3>
                <Input
                  placeholder="Enter your city"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  required
                  aria-invalid={!!errors.location}
                  aria-describedby={errors.location ? "location-error" : undefined}
                />
                {errors.location && (
                  <p className="text-sm text-destructive" id="location-error">
                    {errors.location}
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <Button type="submit" className="w-full bg-thrift-green hover:bg-thrift-green/90" disabled={submitting}>
                {submitting ? "Listing..." : "List Item for Sale"}
              </Button>
            </form>
          </div>

          {/* Sidebar Tips */}
          <div className={cn(
            "space-y-6 opacity-0 animate-in fade-in slide-in-from-bottom-4 duration-500",
            isVisible && "opacity-100"
          )}>
            <div className="bg-card rounded-lg border p-6">
              <h3 className="font-semibold mb-4">Selling Tips</h3>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-2">
                  <Badge className="mt-1">1</Badge>
                  <span>Use natural lighting for clear, bright photos</span>
                </li>
                <li className="flex items-start gap-2">
                  <Badge className="mt-1">2</Badge>
                  <span>Be honest about the condition of your item</span>
                </li>
                <li className="flex items-start gap-2">
                  <Badge className="mt-1">3</Badge>
                  <span>Include measurements for better fit information</span>
                </li>
                <li className="flex items-start gap-2">
                  <Badge className="mt-1">4</Badge>
                  <span>Price competitively based on similar items</span>
                </li>
              </ul>
            </div>
            <div className="bg-card rounded-lg border p-6">
              <h3 className="font-semibold mb-4">Why Sell With Us?</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Plus className="w-4 h-4 text-thrift-green" />
                  <span>Zero listing fees</span>
                </li>
                <li className="flex items-center gap-2">
                  <Plus className="w-4 h-4 text-thrift-green" />
                  <span>Reach eco-conscious buyers</span>
                </li>
                <li className="flex items-center gap-2">
                  <Plus className="w-4 h-4 text-thrift-green" />
                  <span>Secure payment processing</span>
                </li>
                <li className="flex items-center gap-2">
                  <Plus className="w-4 h-4 text-thrift-green" />
                  <span>Seller protection policy</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>
      {/* My Listings section removed. Manage listings from the dedicated My Listings page. */}
      
    </div>
  );
};

export default Sell;