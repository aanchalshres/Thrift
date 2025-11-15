import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { 
  Leaf, 
  Facebook, 
  Instagram, 
  Twitter, 
  Mail, 
  Phone, 
  MapPin,
  Heart
} from "lucide-react";

export const Footer = () => {
  const quickLinks = [
    { label: "About Us", href: "/about" },
    { label: "How It Works", href: "/how-it-works" },
    { label: "Sustainability", href: "/sustainability" },
    { label: "Seller Guide", href: "/seller-guide" },
    { label: "Donation Program", href: "/donate" },
  ];

  const customerService = [
    { label: "Help Center", href: "/help" },
    { label: "Contact Us", href: "/contact" },
    { label: "Shipping Info", href: "/shipping" },
    { label: "Returns", href: "/returns" },
    { label: "Size Guide", href: "/size-guide" },
  ];

  const legal = [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Cookie Policy", href: "/cookies" },
    { label: "Community Guidelines", href: "/guidelines" },
  ];

  return (
    <footer className="bg-card border-t">
      <div className="container mx-auto px-4">
        {/* Main Footer Content */}
        <div className="py-8 lg:py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 lg:gap-8">
          {/* Brand Section */}
          <div className="sm:col-span-2 lg:col-span-2">
            <div className="flex items-center space-x-2 mb-6">
              <img 
                src="/images/logo.png" 
                alt="ThriftSy Logo" 
                className="h-16 w-auto"
              />
            </div>
            
            <p className="text-muted-foreground mb-6 max-w-md">
              Nepal's premier platform for sustainable fashion. Give clothes a second life, 
              support local sellers, and contribute to a greener future.
            </p>

            {/* Contact Info */}
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="w-4 h-4 text-thrift-green" />
                <span>Kathmandu, Nepal</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Phone className="w-4 h-4 text-thrift-green" />
                <span>+977-1-123-4567</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Mail className="w-4 h-4 text-thrift-green" />
                <span>thriftsy.np@gmail.com</span>
              </div>
            </div>

            {/* Social Media */}
            <div className="flex gap-3">
              <Button variant="outline" size="sm" className="w-9 h-9 p-0">
                <Facebook className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" className="w-9 h-9 p-0">
                <Instagram className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" className="w-9 h-9 p-0">
                <Twitter className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link 
                    to={link.href}
                    className="text-muted-foreground hover:text-thrift-green transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Customer Service */}
          <div>
            <h3 className="font-semibold mb-4">Customer Service</h3>
            <ul className="space-y-2">
              {customerService.map((link) => (
                <li key={link.href}>
                  <Link 
                    to={link.href}
                    className="text-muted-foreground hover:text-thrift-green transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h3 className="font-semibold mb-4">Stay Updated</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Get the latest sustainable fashion finds and eco-tips
            </p>
            <div className="space-y-3">
              <Input 
                placeholder="Enter your email"
                className="bg-background"
              />
              <Button className="w-full bg-thrift-green hover:bg-thrift-green/90">
                Subscribe
              </Button>
            </div>
          </div>
        </div>

        <Separator />

        {/* Bottom Footer */}
        <div className="py-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>© 2025 ThriftSy. All rights reserved.</span>
            <div className="hidden md:flex items-center gap-4">
              {legal.map((link) => (
                <Link 
                  key={link.href}
                  to={link.href}
                  className="hover:text-thrift-green transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Made with</span>
            <Heart className="w-4 h-4 text-red-500 fill-current" />
            <span className="text-muted-foreground">for sustainable fashion</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
 //convert this code to next.js material ui typescript taiwndcss color theme shoud be same folder code content shoud be same 