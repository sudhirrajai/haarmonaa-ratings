import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { Star, Upload, Loader2, Quote, QrCode, X, Sparkles, CheckCircle2 } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";

import { getApprovedReviews, submitReview } from "@/lib/reviews.server";
import { getActiveCategories } from "@/lib/admin-categories.server";
import { uploadImage } from "@/lib/upload.server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import heroImage from "@/assets/hero-jewellery.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Haarmonaa | Customer Reviews & Ratings" },
      {
        name: "description",
        content:
          "Scan, rate and review your Haarmonaa handmade jewellery — kada, earrings, necklaces and more. Share a star rating and a photo.",
      },
      { property: "og:title", content: "Haarmonaa | Customer Reviews & Ratings" },
      {
        property: "og:description",
        content:
          "Share a star rating, a short review and a photo of your Haarmonaa jewellery purchase.",
      },
    ],
  }),
  component: Index,
});

const reviewSchema = z.object({
  name: z.string().trim().min(1, "Please add your name").max(100),
  email: z.string().trim().email("Please enter a valid email").max(255),
  phone: z.string().trim().max(20).nullish(),
  product: z.string().trim().min(1, "Pick what you bought").max(80),
  rating: z.number().int().min(1, "Please tap a star rating").max(5),
  comment: z.string().trim().min(1, "Please write a few words").max(1000),
});

/** Read a File as a base64 string (without the data:...;base64, prefix) */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          className={n <= value ? "fill-gold text-gold" : "text-muted-foreground/30"}
        />
      ))}
    </div>
  );
}

const RATING_LABELS: Record<number, string> = {
  1: "Needs improvement",
  2: "Fair",
  3: "Good",
  4: "Very good",
  5: "Loved it! Excellent",
};

const INITIAL_LIMIT = 8;
const PAGE_STEP = 8;

function Index() {
  const queryClient = useQueryClient();
  const [limit, setLimit] = useState(INITIAL_LIMIT);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  // Paginated reviews query with aggregate total & average
  const { data: reviewsData, isLoading, isFetching } = useQuery({
    queryKey: ["reviews", "approved", limit],
    queryFn: () => getApprovedReviews({ data: { limit, offset: 0 } }),
  });

  const { data: categories } = useQuery({
    queryKey: ["categories", "active"],
    queryFn: () => getActiveCategories(),
  });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [product, setProduct] = useState("");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // Use DB categories if loaded, otherwise fall back to static list
  const PRODUCTS = categories?.map((c) => c.name) ?? [
    "Kada", "Earrings", "Jhumkas", "Necklace",
    "Bangles", "Bracelet", "Anklet", "Ring",
    "Maang tikka", "Hair accessory", "Other",
  ];

  const reviews = reviewsData?.reviews ?? [];
  const totalCount = reviewsData?.total ?? 0;
  const averageRating = reviewsData?.average ?? 0;
  const hasMore = reviewsData?.hasMore ?? false;

  function onPickFile(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0] ?? null;
    if (picked && picked.size > 10 * 1024 * 1024) {
      toast.error("That photo is larger than 10 MB. Please pick a smaller one.");
      return;
    }
    setFile(picked);
    setPreview(picked ? URL.createObjectURL(picked) : null);
  }

  function removeFile() {
    setFile(null);
    setPreview(null);
  }

  const submit = useMutation({
    mutationFn: async () => {
      const parsed = reviewSchema.safeParse({
        name,
        email,
        phone: phone || null,
        product,
        rating,
        comment,
      });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Please check the form");
      }

      let imageUrl: string | null = null;

      if (file) {
        const base64 = await fileToBase64(file);
        const result = await uploadImage({
          data: {
            base64,
            mimeType: (file.type || "image/jpeg") as string,
            filename: file.name,
          },
        });
        imageUrl = result.url;
      }

      await submitReview({
        data: {
          name: parsed.data.name,
          email: parsed.data.email,
          phone: parsed.data.phone ?? null,
          product: parsed.data.product,
          rating: parsed.data.rating,
          comment: parsed.data.comment,
          image_url: imageUrl,
        },
      });
    },
    onSuccess: () => {
      toast.success("Thank you! Your review is submitted and will appear shortly after approval.");
      setName("");
      setEmail("");
      setPhone("");
      setProduct("");
      setRating(0);
      setComment("");
      setFile(null);
      setPreview(null);
      void queryClient.invalidateQueries({ queryKey: ["reviews"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    submit.mutate();
  }

  return (
    <div className="min-h-screen">
      {/* Top Brand Navigation — Clean & responsive, no text collision, admin hidden */}
      <nav className="sticky top-0 z-30 border-b border-border/40 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 py-2.5">
          <Link
            to="/"
            className="flex items-center gap-2 transition-transform hover:scale-105"
            aria-label="Haarmonaa Home"
          >
            <img
              src="/logo-circle.png"
              alt="Haarmonaa"
              className="h-9 w-9 sm:h-10 sm:w-10 rounded-full border border-primary/40 shadow-sm object-cover"
            />
          </Link>

          <Link
            to="/qr"
            className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/60 px-3.5 py-1.5 text-xs font-medium text-foreground transition-all hover:border-primary/40 hover:bg-secondary active:scale-95"
          >
            <QrCode size={13} className="text-primary" />
            <span>QR Code</span>
          </Link>
        </div>
      </nav>

      {/* Hero Banner Header */}
      <header className="relative overflow-hidden">
        <img
          src={heroImage}
          alt="Haarmonaa luxury jewellery"
          width={1600}
          height={912}
          className="h-[42vh] min-h-72 w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/20" />
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-3xl px-4 pb-8 text-center sm:px-6">
          <div className="mb-3 flex justify-center">
            <img
              src="/logo-circle.png"
              alt="Haarmonaa Emblem"
              className="h-20 w-20 rounded-full border-2 border-primary/60 shadow-glow p-1 bg-card/90 backdrop-blur-md transition-transform hover:scale-105 duration-300"
            />
          </div>

          <p className="text-[11px] uppercase tracking-[0.35em] text-primary font-medium">
            Haarmonaa · Luxury Handmade Jewellery
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">
            <span className="text-gradient-gold">Customer</span> Reviews & Ratings
          </h1>
          <p className="mx-auto mt-2.5 max-w-lg text-xs text-muted-foreground sm:text-sm">
            Handcrafted with elegance, devotion, and beauty. Tell us about your jewellery piece and share a photo wearing it.
          </p>

          {totalCount > 0 && (
            <div className="mt-4 inline-flex items-center gap-2.5 rounded-full border border-border/80 bg-card/80 px-4 py-1.5 backdrop-blur-sm shadow-sm">
              <Stars value={Math.round(averageRating)} size={15} />
              <span className="text-xs font-semibold text-foreground">{averageRating.toFixed(1)} / 5</span>
              <span className="text-xs text-muted-foreground">
                · {totalCount} {totalCount === 1 ? "review" : "reviews"}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,400px)_1fr]">
        {/* Left Column: Review Submission Form */}
        <section className="panel h-fit p-5 sm:p-7">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-primary" />
            <h2 className="text-xl font-semibold sm:text-2xl">Leave your review</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Takes less than a minute. Your email stays private.
          </p>

          <form onSubmit={onSubmit} className="mt-5 space-y-4 sm:space-y-5">
            {/* Product Category Chips */}
            <div className="space-y-2">
              <Label className="text-xs sm:text-sm font-medium">What did you purchase?</Label>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {PRODUCTS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setProduct(item)}
                    className={`rounded-full border px-3 py-1 text-xs sm:text-sm transition-all active:scale-95 ${
                      product === item
                        ? "border-primary bg-primary text-primary-foreground font-medium shadow-sm"
                        : "border-border/80 bg-background/50 text-muted-foreground hover:border-primary/50 hover:bg-secondary/60 hover:text-foreground"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            {/* Star Rating Picker */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs sm:text-sm font-medium">Your rating</Label>
                <span className="text-xs text-primary/80 font-medium">
                  {RATING_LABELS[hoverRating || rating] || "Select stars"}
                </span>
              </div>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-label={`${n} star`}
                    onClick={() => setRating(n)}
                    onMouseEnter={() => setHoverRating(n)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="transition-transform hover:scale-115 focus:outline-none"
                  >
                    <Star
                      size={28}
                      className={`transition-colors ${
                        n <= (hoverRating || rating)
                          ? "fill-gold text-gold"
                          : "text-muted-foreground/30 hover:text-gold/50"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Name & Phone */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs sm:text-sm">Name</Label>
                <Input
                  id="name"
                  value={name}
                  maxLength={100}
                  required
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Priya Shah"
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-xs sm:text-sm">Phone (optional)</Label>
                <Input
                  id="phone"
                  value={phone}
                  maxLength={20}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="bg-background/50"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs sm:text-sm">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                maxLength={255}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="bg-background/50"
              />
            </div>

            {/* Review Comment */}
            <div className="space-y-1.5">
              <Label htmlFor="comment" className="text-xs sm:text-sm">Your review</Label>
              <Textarea
                id="comment"
                required
                value={comment}
                maxLength={1000}
                rows={3}
                onChange={(e) => setComment(e.target.value)}
                placeholder="The craftsmanship is stunning and it paired beautifully with my festive outfit..."
                className="bg-background/50"
              />
            </div>

            {/* Photo Uploader */}
            <div className="space-y-1.5">
              <Label htmlFor="photo" className="text-xs sm:text-sm">Add a photo of your purchase (optional)</Label>
              {!preview ? (
                <label
                  htmlFor="photo"
                  className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border/90 bg-background/40 p-4 text-center text-xs text-muted-foreground transition-all hover:border-primary/50 hover:bg-secondary/40"
                >
                  <Upload size={20} className="mb-1 text-primary/70" />
                  <span className="font-medium text-foreground">Click or tap to upload photo</span>
                  <span className="text-[11px] text-muted-foreground mt-0.5">JPG, PNG, WebP up to 10 MB</span>
                </label>
              ) : (
                <div className="relative mt-2 inline-block">
                  <img
                    src={preview}
                    alt="Preview"
                    className="h-28 w-28 rounded-xl object-cover border border-primary/30 shadow-md"
                  />
                  <button
                    type="button"
                    onClick={removeFile}
                    className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-md transition-transform hover:scale-110"
                    aria-label="Remove photo"
                  >
                    <X size={14} />
                  </button>
                  <p className="mt-1 text-[11px] text-muted-foreground truncate max-w-[120px]">
                    {file?.name}
                  </p>
                </div>
              )}
              <input
                id="photo"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onPickFile}
              />
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full font-medium"
              disabled={submit.isPending}
            >
              {submit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {submit.isPending ? "Submitting review..." : "Submit Review"}
            </Button>
          </form>
        </section>

        {/* Right Column: Customer Reviews Feed */}
        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold sm:text-2xl">Customer Reviews</h2>
            {totalCount > 0 && (
              <span className="text-xs text-muted-foreground">
                Showing {reviews.length} of {totalCount}
              </span>
            )}
          </div>

          {isLoading && (
            <div className="mt-6 flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              Loading reviews...
            </div>
          )}

          {!isLoading && reviews.length === 0 && (
            <div className="panel mt-5 p-10 text-center text-sm text-muted-foreground">
              <p className="text-base font-medium text-foreground">No reviews yet</p>
              <p className="mt-1 text-xs">Be the first to share your thoughts on our jewellery!</p>
            </div>
          )}

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {reviews.map((review) => (
              <article
                key={review.id}
                className="panel flex flex-col justify-between gap-3 p-4 sm:p-5 transition-all hover:border-primary/40 hover:shadow-glow/10"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      {/* Avatar initial */}
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary border border-primary/30">
                        {review.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-sm font-semibold leading-tight text-foreground">
                            {review.name}
                          </h3>
                          <span title="Verified Customer" className="text-emerald-500">
                            <CheckCircle2 size={13} />
                          </span>
                        </div>
                        <span className="inline-block text-[11px] font-medium uppercase tracking-wider text-primary">
                          {review.product}
                        </span>
                      </div>
                    </div>
                    <Stars value={review.rating} size={14} />
                  </div>

                  <p className="mt-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    <Quote size={13} className="inline mr-1 text-gold/60 align-baseline" />
                    {review.comment}
                  </p>
                </div>

                {/* Lazy-loaded photo with click-to-zoom modal */}
                {review.photo && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => setLightboxImg(review.photo)}
                      className="group relative block w-full overflow-hidden rounded-xl focus:outline-none"
                    >
                      <img
                        src={review.photo}
                        alt={`Photo shared by ${review.name} wearing ${review.product}`}
                        loading="lazy"
                        decoding="async"
                        className="h-44 sm:h-48 w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <span className="absolute bottom-2 right-2 rounded-md bg-background/80 px-2 py-0.5 text-[10px] font-medium text-foreground backdrop-blur-sm opacity-90 group-hover:opacity-100">
                        Tap to view
                      </span>
                    </button>
                  </div>
                )}

                <p className="border-t border-border/40 pt-2 text-[11px] text-muted-foreground/60">
                  {new Date(review.created_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </article>
            ))}
          </div>

          {/* Load More Button — Prevents loading hundreds of reviews/photos at once */}
          {hasMore && (
            <div className="mt-8 flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => setLimit((prev) => prev + PAGE_STEP)}
                disabled={isFetching}
                className="rounded-full border-primary/30 px-7 text-xs sm:text-sm font-medium hover:border-primary hover:bg-primary/10 active:scale-95"
              >
                {isFetching ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading more...
                  </>
                ) : (
                  `Load More Reviews (${totalCount - reviews.length} more)`
                )}
              </Button>
            </div>
          )}
        </section>
      </main>

      {/* Lightbox Photo Modal */}
      {lightboxImg && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          onClick={() => setLightboxImg(null)}
        >
          <div className="relative max-h-[90vh] max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <img
              src={lightboxImg}
              alt="Customer jewellery review photo"
              className="max-h-[85vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl border border-primary/30"
            />
            <button
              type="button"
              onClick={() => setLightboxImg(null)}
              className="absolute -top-3 -right-3 flex h-8 w-8 items-center justify-center rounded-full bg-background/90 text-foreground shadow-lg border border-border hover:bg-secondary"
              aria-label="Close photo preview"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Branded Footer */}
      <footer className="border-t border-border/40 py-10 text-center text-xs text-muted-foreground">
        <div className="mb-3 flex items-center justify-center gap-2.5">
          <img src="/logo-circle.png" alt="Haarmonaa" className="h-6 w-6 rounded-full border border-primary/30" />
          <span className="font-serif tracking-[0.25em] text-sm font-semibold text-foreground">HAARMONAA</span>
        </div>
        Handcrafted luxury jewellery · Crafted with elegance, devotion, and beauty
      </footer>
    </div>
  );
}
