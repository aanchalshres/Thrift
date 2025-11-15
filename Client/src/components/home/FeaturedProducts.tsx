"use client";

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@mui/material";
import ArrowRightAltIcon from "@mui/icons-material/ArrowRightAlt";
import { ProductCard } from "@/components/product/ProductCard";
import { useAuth } from "@/context/AuthContext";

type Product = {
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
  status?: string;
};

export const FeaturedProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [moreProducts, setMoreProducts] = useState<Product[]>([]);
  const [showAll, setShowAll] = useState(false);
  const apiBase = import.meta.env.VITE_API_URL || "https://thrift-production-af9f.up.railway.app";
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  // Fetch data from backend, fallback to mock
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Try backend API
        const res = await fetch(`${apiBase}/api/products`);
        if (!res.ok) throw new Error("Backend not available");
        const data = await res.json();
        if (Array.isArray(data)) {
          // Map server rows to Product shape if needed
          const mapped: Product[] = data.map((p: any) => ({
            id: String(p.id),
            title: p.title,
            price: Number(p.price ?? 0),
            originalPrice: p.originalPrice != null ? Number(p.originalPrice) : 0,
            brand: p.brand || "",
            size: p.size || "",
            condition: (p.productCondition || p.condition || "Good") as any,
            images: Array.isArray(p.images)
              ? p.images
              : (typeof p.images === 'string' && p.images.startsWith('[')
                  ? JSON.parse(p.images)
                  : (p.image ? [p.image] : [])),
            seller: p.seller || "",
            location: p.location || "",
            status: (p.status || '').toString(),
          }));
          setProducts(mapped.slice(0, 8));
          setMoreProducts(mapped.slice(8));
        } else {
          // Fallback to mock-compatible shape
          setProducts(data.initialProducts || []);
          setMoreProducts(data.moreProducts || []);
        }
      } catch (err) {
        console.warn("Using mock data instead:", err);
        const res = await fetch("/mock/data.json");
        const data = await res.json();
        setProducts(data.initialProducts || []);
        setMoreProducts(data.moreProducts || []);
      }
    };

    fetchData();
  }, []);

  const handleViewAll = () => {
    if (!isAuthenticated) {
      navigate(`/signup?next=${encodeURIComponent('/shop')}`);
    } else {
      navigate("/shop");
    }
  };

  return (
    <section className="py-16 bg-background">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Featured Pre-Loved Items
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Discover carefully curated, high-quality second-hand fashion items
            from our trusted sellers
          </p>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {products.map((product) => (
            <ProductCard key={product.id} {...product} status={product.status} />
          ))}
        </div>

        {/* View All Button */}
        {!showAll && products.length > 0 && (
          <div className="text-center">
            <Button
              variant="outlined"
              size="large"
              onClick={handleViewAll}
              className="!border-thrift-green !text-thrift-green hover:!bg-thrift-green hover:!text-white"
              endIcon={<ArrowRightAltIcon className="w-5 h-5" />}
            >
              View All Products
            </Button>
          </div>
        )}
      </div>
    </section>
  );
};
