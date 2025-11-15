import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

type Category = {
  label: string;      // Display name
  value: string;      // Query param used by Shop filter
  image: string;      // Background image
  color: string;      // Tailwind gradient overlay
  count?: string;     // Optional count text
};

export const CategorySection = () => {
  const navigate = useNavigate();
  // Categories aligned with Shop filter values
  const categories = useMemo<Category[]>(() => [
    {
      label: "Women's Clothing",
      value: "women",
      image: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=1200&q=60",
      color: "from-pink-500/30 to-purple-500/30",
      count: "2,500+ items",
    },
    {
      label: "Men's Clothing",
      value: "men",
      image: "images/men.jpeg",
      color: "from-blue-500/30 to-cyan-500/30",
      count: "1,800+ items",
    },
    {
      label: "Unisex",
      value: "unisex",
      image: "images/unisex.jpg",
      color: "from-indigo-500/30 to-purple-500/30",
      count: "500+ items",
    },
    {
      label: "Kids' Clothing",
      value: "kids",
      image: "images/kids.jpg",
      color: "from-teal-500/30 to-blue-500/30",
      count: "600+ items",
    },
    {
      label: "Accessories",
      value: "accessories",
      image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1200&q=60",
      color: "from-green-500/30 to-emerald-500/30",
      count: "1,200+ items",
    },
    {
      label: "Shoes",
      value: "shoes",
      image: "https://images.unsplash.com/photo-1560769629-975ec94e6a86?auto=format&fit=crop&w=1200&q=60",
      color: "from-emerald-500/30 to-emerald-600/30",
      count: "950+ items",
    },
  ], []);

  const goToCategory = (value: string) => {
    navigate(`/shop?category=${encodeURIComponent(value)}`);
  };

  return (
    <section className="py-16 bg-thrift-cream/30">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Shop by Category
          </h2>
          <p className="text-lg text-muted-foreground">
            Find exactly what you're looking for in our organized collections
          </p>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {categories.map((category, index) => (
            <Card
              key={index}
              className="group overflow-hidden hover:shadow-lg transition-all duration-300 border-none cursor-pointer"
              onClick={() => goToCategory(category.value)}
            >
              <div className="relative h-48 overflow-hidden">
                <img
                  src={category.image}
                  alt={category.label}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div
                  className={`absolute inset-0 bg-gradient-to-t ${category.color} group-hover:opacity-80 transition-opacity`}
                />

                {/* Content Overlay */}
                <div className="absolute inset-0 flex items-end p-6">
                  <div className="text-white">
                    <h3 className="text-xl font-bold mb-1">{category.label}</h3>
                    {category.count && <p className="text-white/90 mb-3">{category.count}</p>}
                    <Button
                      size="sm"
                      className="bg-white/20 backdrop-blur text-white border-white/30 hover:bg-white hover:text-gray-900"
                      variant="outline"
                      onClick={(e) => { e.stopPropagation(); goToCategory(category.value); }}
                    >
                      Explore
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
