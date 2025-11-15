import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Upload, HeartHandshake, Coins, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FormData {
  name: string;
  email: string;
  phone: string;
  address: string;
  itemName: string;
  description: string;
  category: string;
  size: string;
  condition: string;
  images: string[];
  donationAmount?: string;
  message?: string;
}

export const Donate = () => {
  const [donationType, setDonationType] = useState<"items" | "money">("items");
  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    phone: "",
    address: "",
    itemName: "",
    description: "",
    category: "",
    size: "",
    condition: "",
    images: [],
    donationAmount: "",
    message: "",
  });
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submissionStatus, setSubmissionStatus] = useState<"idle" | "success" | "error">("idle");

  const categories = [
    "Women's Clothing",
    "Men's Clothing",
    "Unisex",
    "Kids' Clothing",
    "Accessories",
    "Shoes",
    "Home Goods",
  ];

  const conditions = ["Like New", "Excellent", "Good", "Fair"];

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newImages: string[] = [];
      const previews: string[] = [];
      Array.from(files).forEach((file) => {
        if (file.size > 2 * 1024 * 1024) {
          setErrors((prev) => ({
            ...prev,
            images: "Each image must be under 2MB",
          }));
          return;
        }
        if (!file.type.startsWith("image/")) {
          setErrors((prev) => ({
            ...prev,
            images: "Only image files are allowed",
          }));
          return;
        }
        newImages.push(file.name); // Store file name or use a real URL in production
        previews.push(URL.createObjectURL(file));
      });
      setFormData((prev) => ({ ...prev, images: newImages }));
      setImagePreviews(previews);
      setErrors((prev) => ({ ...prev, images: "" }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (donationType === "items") {
      if (!formData.name) newErrors.name = "Name is required";
      if (!formData.email || !/\S+@\S+\.\S+/.test(formData.email))
        newErrors.email = "Valid email is required";
      if (!formData.phone) newErrors.phone = "Phone number is required";
      if (!formData.address) newErrors.address = "Address is required";
      if (!formData.itemName) newErrors.itemName = "Item name is required";
      if (!formData.description) newErrors.description = "Description is required";
      if (!formData.category) newErrors.category = "Category is required";
      if (!formData.condition) newErrors.condition = "Condition is required";
      if (formData.images.length === 0)
        newErrors.images = "At least one image is required";
    } else {
      if (!formData.donationAmount || Number(formData.donationAmount) <= 0)
        newErrors.donationAmount = "Valid donation amount is required";
      if (!formData.name) newErrors.name = "Name is required";
      if (!formData.email || !/\S+@\S+\.\S+/.test(formData.email))
        newErrors.email = "Valid email is required";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    // Simulate API call and store in localStorage
    try {
      const donations = JSON.parse(localStorage.getItem("donations") || "[]");
      donations.push({ ...formData, type: donationType, timestamp: new Date().toISOString() });
      localStorage.setItem("donations", JSON.stringify(donations));
      setSubmissionStatus("success");
      setFormData({
        name: "",
        email: "",
        phone: "",
        address: "",
        itemName: "",
        description: "",
        category: "",
        size: "",
        condition: "",
        images: [],
        donationAmount: "",
        message: "",
      });
      setImagePreviews([]);
      setTimeout(() => setSubmissionStatus("idle"), 3000); // Reset status after 3s
    } catch (error) {
      setSubmissionStatus("error");
      setTimeout(() => setSubmissionStatus("idle"), 3000);
    }
  };

  const handlePresetAmount = (amount: number) => {
    setFormData((prev) => ({ ...prev, donationAmount: amount.toString() }));
    setErrors((prev) => ({ ...prev, donationAmount: "" }));
  };

  return (
    <div className="min-h-screen bg-background">
      
      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2 text-[hsl(var(--thrift-green))]">
            Give Back with Style
          </h1>
          <p className="text-foreground/90 max-w-2xl mx-auto">
            Donate your pre-loved items or make a monetary contribution to support sustainable fashion initiatives in Nepal.
          </p>
        </div>

        {/* Success/Error Message */}
          {submissionStatus === "success" && (
            <div className="mb-6 p-4 bg-thrift-green/10 border border-thrift-green rounded-md text-center">
              <p className="text-thrift-green font-medium">
              Thank you for your donation! We'll reach out soon.
            </p>
          </div>
        )}
        {submissionStatus === "error" && (
          <div className="mb-6 p-4 bg-thrift-green/10 border border-thrift-green rounded-md text-center">
            <p className="text-thrift-green font-medium">
              An error occurred. Please try again.
            </p>
          </div>
        )}

        <Tabs
          defaultValue="items"
          className="w-full"
          onValueChange={(value) => setDonationType(value as "items" | "money")}
        >
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8 bg-thrift-cream">
            <TabsTrigger
              value="items"
              className="text-foreground data-[state=active]:bg-thrift-green data-[state=active]:text-white"
            >
              Donate Items
            </TabsTrigger>
            <TabsTrigger
              value="money"
              className="text-foreground data-[state=active]:bg-thrift-green data-[state=active]:text-white"
            >
              Monetary Donation
            </TabsTrigger>
          </TabsList>

          <TabsContent value="items">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Donation Form */}
              <Card className="border-none shadow-sm bg-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-[hsl(var(--thrift-green))]">
                    <Upload className="w-5 h-5" />
                    Item Donation Form
                  </CardTitle>
                  <CardDescription>
                    Tell us about the item you'd like to donate
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label htmlFor="name" className="text-sm font-medium">
                          Your Name
                        </label>
                        <Input
                          id="name"
                          name="name"
                          placeholder="Full Name"
                          value={formData.name}
                          onChange={handleInputChange}
                          required
                          aria-invalid={!!errors.name}
                          aria-describedby={errors.name ? "name-error" : undefined}
                        />
                        {errors.name && (
                    <p id="name-error" className="text-sm text-thrift-green">
                            {errors.name}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="email" className="text-sm font-medium">
                          Email
                        </label>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          placeholder="Email Address"
                          value={formData.email}
                          onChange={handleInputChange}
                          required
                          aria-invalid={!!errors.email}
                          aria-describedby={errors.email ? "email-error" : undefined}
                        />
                        {errors.email && (
                    <p id="email-error" className="text-sm text-thrift-green">
                            {errors.email}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label htmlFor="phone" className="text-sm font-medium">
                          Phone
                        </label>
                        <Input
                          id="phone"
                          name="phone"
                          placeholder="Phone Number"
                          value={formData.phone}
                          onChange={handleInputChange}
                          required
                          aria-invalid={!!errors.phone}
                          aria-describedby={errors.phone ? "phone-error" : undefined}
                        />
                        {errors.phone && (
                    <p id="phone-error" className="text-sm text-thrift-green">
                            {errors.phone}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="category" className="text-sm font-medium">
                          Category
                        </label>
                        <Select
                          value={formData.category}
                          onValueChange={(value) => handleSelectChange("category", value)}
                          aria-invalid={!!errors.category}
                          aria-describedby={errors.category ? "category-error" : undefined}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select Category" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((category) => (
                              <SelectItem
                                key={category}
                                value={category.toLowerCase()}
                              >
                                {category}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {errors.category && (
                    <p id="category-error" className="text-sm text-thrift-green">
                            {errors.category}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="itemName" className="text-sm font-medium">
                        Item Name
                      </label>
                      <Input
                        id="itemName"
                        name="itemName"
                        placeholder="e.g. Denim Jacket, Silk Saree, etc."
                        value={formData.itemName}
                        onChange={handleInputChange}
                        required
                        aria-invalid={!!errors.itemName}
                        aria-describedby={errors.itemName ? "itemName-error" : undefined}
                      />
                      {errors.itemName && (
                  <p id="itemName-error" className="text-sm text-thrift-green">
                          {errors.itemName}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="description" className="text-sm font-medium">
                        Description
                      </label>
                      <Textarea
                        id="description"
                        name="description"
                        placeholder="Describe the item, including brand, material, and any notable features"
                        value={formData.description}
                        onChange={handleInputChange}
                        required
                        aria-invalid={!!errors.description}
                        aria-describedby={errors.description ? "description-error" : undefined}
                      />
                      {errors.description && (
                  <p id="description-error" className="text-sm text-thrift-green">
                          {errors.description}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label htmlFor="size" className="text-sm font-medium">
                          Size
                        </label>
                        <Input
                          id="size"
                          name="size"
                          placeholder="S, M, L, etc."
                          value={formData.size}
                          onChange={handleInputChange}
                          aria-invalid={!!errors.size}
                          aria-describedby={errors.size ? "size-error" : undefined}
                        />
                        {errors.size && (
                    <p id="size-error" className="text-sm text-thrift-green">
                            {errors.size}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="condition" className="text-sm font-medium">
                          Condition
                        </label>
                        <Select
                          value={formData.condition}
                          onValueChange={(value) => handleSelectChange("condition", value)}
                          aria-invalid={!!errors.condition}
                          aria-describedby={errors.condition ? "condition-error" : undefined}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select Condition" />
                          </SelectTrigger>
                          <SelectContent>
                            {conditions.map((condition) => (
                              <SelectItem
                                key={condition}
                                value={condition.toLowerCase()}
                              >
                                {condition}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {errors.condition && (
                    <p id="condition-error" className="text-sm text-thrift-green">
                            {errors.condition}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="address" className="text-sm font-medium">
                        Pickup Address
                      </label>
                      <Input
                        id="address"
                        name="address"
                        placeholder="Your address for item pickup"
                        value={formData.address}
                        onChange={handleInputChange}
                        required
                        aria-invalid={!!errors.address}
                        aria-describedby={errors.address ? "address-error" : undefined}
                      />
                      {errors.address && (
                  <p id="address-error" className="text-sm text-thrift-green">
                          {errors.address}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Item Photos</label>
                      <div className="flex items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-thrift-cream">
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          id="imageUpload"
                          onChange={handleImageUpload}
                          aria-label="Upload item photos"
                        />
                        <label
                          htmlFor="imageUpload"
                          className="flex flex-col items-center justify-center w-full h-full text-center"
                        >
                          <Upload className="w-8 h-8 mx-auto text-thrift-green" />
                          <p className="text-sm text-foreground/80">
                            Click to upload photos of your item
                          </p>
                        </label>
                      </div>
                      {errors.images && (
                  <p className="text-sm text-thrift-green">{errors.images}</p>
                      )}
                      {imagePreviews.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {imagePreviews.map((preview, index) => (
                            <img
                              key={index}
                              src={preview}
                              alt={`Preview ${index + 1}`}
                              className="w-16 h-16 object-cover rounded-md"
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    <Button
                      type="submit"
                      className="w-full bg-thrift-green hover:bg-thrift-green/90 text-white"
                    >
                      Submit Donation
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Information Panel */}
              <div className="space-y-6">
                <Card className="border-none shadow-sm bg-card">
                  <CardHeader>
                    <CardTitle className="text-[hsl(var(--thrift-green))]">
                      Why Donate Items?
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-thrift-green mt-0.5" />
                      <div>
                        <h4 className="font-medium">Reduce Fashion Waste</h4>
                        <p className="text-sm text-foreground/80">
                          Extend the life of clothing and reduce environmental impact
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-thrift-green mt-0.5" />
                      <div>
                        <h4 className="font-medium">Support Local Communities</h4>
                        <p className="text-sm text-foreground/80">
                          Your donations help provide affordable clothing options
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-thrift-green mt-0.5" />
                      <div>
                        <h4 className="font-medium">Tax Benefits</h4>
                        <p className="text-sm text-foreground/80">
                          Receive a tax receipt for your donated items
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-card">
                  <CardHeader>
                    <CardTitle className="text-[hsl(var(--thrift-green))]">
                      What We Accept
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-thrift-green" />
                        <span>Gently used clothing</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-thrift-green" />
                        <span>Shoes and accessories</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-thrift-green" />
                        <span>Home textiles (clean blankets, curtains)</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-thrift-green" />
                        <span>Traditional wear in good condition</span>
                      </li>
                    </ul>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-card">
                  <CardHeader>
                    <CardTitle className="text-[hsl(var(--thrift-green))]">
                      Pickup Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">
                      We offer free pickup services in Kathmandu and Pokhara valley. After
                      submitting your donation, our team will contact you within 2
                      business days to schedule a pickup.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="money">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Monetary Donation Form */}
              <Card className="border-none shadow-sm bg-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-[hsl(var(--thrift-green))]">
                    <Coins className="w-5 h-5" />
                    Make a Monetary Donation
                  </CardTitle>
                  <CardDescription className="text-foreground/80">
                    Your financial support helps us sustain our operations and expand
                    our impact
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <label
                        htmlFor="donationAmount"
                        className="text-sm font-medium"
                      >
                        Donation Amount (NPR)
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {[500, 1000, 2000, 5000].map((amount) => (
                          <Button
                            key={amount}
                            type="button"
                            variant="outline"
                            className="border-thrift-green text-thrift-green hover:bg-thrift-green/10"
                            onClick={() => handlePresetAmount(amount)}
                          >
                            {amount}
                          </Button>
                        ))}
                      </div>
                      <Input
                        id="donationAmount"
                        name="donationAmount"
                        placeholder="Or enter custom amount"
                        type="number"
                        value={formData.donationAmount}
                        onChange={handleInputChange}
                        required
                        aria-invalid={!!errors.donationAmount}
                        aria-describedby={
                          errors.donationAmount ? "donationAmount-error" : undefined
                        }
                      />
                      {errors.donationAmount && (
                        <p
                          id="donationAmount-error"
                          className="text-sm text-thrift-warm"
                        >
                          {errors.donationAmount}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="donorName" className="text-sm font-medium">
                        Your Name
                      </label>
                      <Input
                        id="donorName"
                        name="name"
                        placeholder="Full Name"
                        value={formData.name}
                        onChange={handleInputChange}
                        required
                        aria-invalid={!!errors.name}
                        aria-describedby={errors.name ? "name-error" : undefined}
                      />
                      {errors.name && (
                        <p id="name-error" className="text-sm text-thrift-warm">
                          {errors.name}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="donorEmail" className="text-sm font-medium">
                        Email
                      </label>
                      <Input
                        id="donorEmail"
                        name="email"
                        type="email"
                        placeholder="Email Address"
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                        aria-invalid={!!errors.email}
                        aria-describedby={errors.email ? "email-error" : undefined}
                      />
                      {errors.email && (
                        <p id="email-error" className="text-sm text-thrift-warm">
                          {errors.email}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="message" className="text-sm font-medium">
                        Message (Optional)
                      </label>
                      <Textarea
                        id="message"
                        name="message"
                        placeholder="Add a personal message with your donation"
                        value={formData.message}
                        onChange={handleInputChange}
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full bg-thrift-green hover:bg-thrift-green/90 text-white"
                    >
                      Donate Now
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Information Panel */}
              <div className="space-y-6">
                <Card className="border-none shadow-sm bg-card">
                  <CardHeader>
                    <CardTitle className="text-[hsl(var(--thrift-green))]">
                      How Your Money Helps
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-start gap-3">
                      <HeartHandshake className="w-5 h-5 text-thrift-green mt-0.5" />
                      <div>
                        <h4 className="font-medium">Clothing Distribution</h4>
                        <p className="text-sm text-foreground/80">
                          NPR 1000 provides 5 outfits to people in need
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <HeartHandshake className="w-5 h-5 text-thrift-green mt-0.5" />
                      <div>
                        <h4 className="font-medium">Educational Programs</h4>
                        <p className="text-sm text-foreground/80">
                          Support our sustainable fashion workshops
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <HeartHandshake className="w-5 h-5 text-thrift-green mt-0.5" />
                      <div>
                        <h4 className="font-medium">Operational Costs</h4>
                        <p className="text-sm text-foreground/80">
                          Help us maintain our pickup and distribution network
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-card">
                  <CardHeader>
                    <CardTitle className="text-[hsl(var(--thrift-green))]">
                      Payment Methods
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-thrift-green" />
                        <span>Credit/Debit Card</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-thrift-green" />
                        <span>Mobile Banking (eSewa, Khalti)</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-thrift-green" />
                        <span>Bank Transfer</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-thrift-green" />
                        <span>Digital Wallet</span>
                      </li>
                    </ul>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-card">
                  <CardHeader>
                    <CardTitle className="text-[hsl(var(--thrift-green))]">
                      Tax Benefits
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">
                      All monetary donations are tax-deductible. You will receive an
                      official receipt for tax purposes after your donation is
                      processed.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Back to Shop Link */}
        <div className="mt-8 text-center">
          <Link to="/shop">
            <Button
              variant="outline"
              className="bg-white border-thrift-green text-thrift-green hover:bg-thrift-green/10"
            >
              Continue Shopping
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
};

export default Donate;