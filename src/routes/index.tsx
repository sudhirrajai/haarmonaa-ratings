import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { Star, Upload, Loader2, Quote } from "lucide-react";
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
      { title: "Rate our Navratri handmade jewellery | Reviews" },
      {
        name: "description",
        content:
          "Scan, rate and review your handmade Navratri jewellery — kada, earrings, necklaces and more. Share a star rating, a few words and a photo of what you bought.",
      },
      { property: "og:title", content: "Rate our Navratri handmade jewellery" },
      {
        property: "og:description",
        content:
          "Share a star rating, a short review and a photo of your handmade jewellery purchase.",
      },
    ],
  }),
  component: Index,
});

const reviewSchema = z.object({
  name: z.string().trim().min(1, "Please add your name").max(100),
  email: z.string().trim().email("Please enter a valid email").max(255),
  phone: z.string().trim().max(20).optional(),
  product: z.string().trim().min(1, "Pick what you bought").max(80),
  rating: z.number().int().min(1, "Please tap a star rating").max(5),
  comment: z.string().trim().min(1, "Please write a few words").max(1000),
});

type Review = {
  id: string;
  name: string;
  product: string;
  rating: number;
  comment: string;
  photo: string | null;
  created_at: string;
};

/** Read a File as a base64 string (without the data:...;base64, prefix) */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the "data:image/jpeg;base64," prefix
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
          className={n <= value ? "fill-gold text-gold" : "text-muted-foreground/40"}
        />
      ))}
    </div>
  );
}

function useApprovedReviews() {
  return useQuery({
    queryKey: ["reviews", "approved"],
    queryFn: () => getApprovedReviews(),
  });
}

function useActiveCategories() {
  return useQuery({
    queryKey: ["categories", "active"],
    queryFn: () => getActiveCategories(),
  });
}

function Index() {
  const queryClient = useQueryClient();
  const { data: reviews, isLoading } = useApprovedReviews();
  const { data: categories } = useActiveCategories();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [product, setProduct] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // Use DB categories if loaded, otherwise fall back to static list
  const PRODUCTS = categories?.map((c) => c.name) ?? [
    "Kada", "Earrings", "Jhumkas", "Necklace",
    "Bangles", "Bracelet", "Anklet", "Ring",
    "Maang tikka", "Hair accessory", "Other",
  ];

  const count = reviews?.length ?? 0;
  const average = count ? reviews!.reduce((s, r) => s + r.rating, 0) / count : 0;

  function onPickFile(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0] ?? null;
    if (picked && picked.size > 10 * 1024 * 1024) {
      toast.error("That photo is larger than 10 MB. Please pick a smaller one.");
      return;
    }
    setFile(picked);
    setPreview(picked ? URL.createObjectURL(picked) : null);
  }

  const submit = useMutation({
    mutationFn: async () => {
      const parsed = reviewSchema.safeParse({
        name, email,
        phone: phone || undefined,
        product, rating, comment,
      });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Please check the form");
      }

      let imageUrl: string | null = null;

      if (file) {
        // Convert to base64 and upload to local server — no cloud dependency
        const base64 = await fileToBase64(file);
        const result = await uploadImage({
          data: {
            base64,
            mimeType: (file.type || "image/jpeg") as string,
            filename: file.name,
          },
        });
        imageUrl = result.url; // e.g. /uploads/abc.jpg
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
      toast.success("Thank you! Your review is pending approval and will appear shortly.");
      setName(""); setEmail(""); setPhone(""); setProduct("");
      setRating(0); setComment(""); setFile(null); setPreview(null);
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
      <header className="relative overflow-hidden">
        <img
          src={heroImage}
          alt="Handmade kada bangles, jhumka earrings and oxidised necklaces on maroon silk with marigolds and diyas"
          width={1600}
          height={912}
          className="h-[46vh] min-h-72 w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/20" />
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-3xl px-5 pb-8 text-center">
          <p className="text-xs uppercase tracking-[0.35em] text-primary">Navratri 2026 · Stall</p>
          <h1 className="mt-3 text-4xl font-semibold sm:text-5xl">
            <span className="text-gradient-gold">Handmade Jewellery</span> Reviews
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
            Kada, earrings, necklaces and more — crafted by hand. Tell us how you liked your
            purchase and add a photo of you wearing it.
          </p>
          {count > 0 && (
            <div className="mt-5 inline-flex items-center gap-3 rounded-full border border-border bg-card/70 px-5 py-2">
              <Stars value={Math.round(average)} />
              <span className="text-sm font-medium">{average.toFixed(1)} / 5</span>
              <span className="text-sm text-muted-foreground">
                · {count} {count === 1 ? "review" : "reviews"}
              </span>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-10 px-5 py-12 lg:grid-cols-[minmax(0,420px)_1fr]">
        <section className="panel h-fit p-6 sm:p-7">
          <h2 className="text-2xl font-semibold">Leave your review</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            It takes less than a minute. Your email stays private.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-5">
            <div className="space-y-2">
              <Label>What did you buy?</Label>
              <div className="flex flex-wrap gap-2">
                {PRODUCTS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setProduct(item)}
                    className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                      product === item
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Your rating</Label>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-label={`${n} star`}
                    onClick={() => setRating(n)}
                    className="transition-transform hover:scale-110"
                  >
                    <Star
                      size={30}
                      className={n <= rating ? "fill-gold text-gold" : "text-muted-foreground/40"}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  maxLength={100}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Priya Shah"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone (optional)</Label>
                <Input
                  id="phone"
                  value={phone}
                  maxLength={20}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                maxLength={255}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="comment">Your review</Label>
              <Textarea
                id="comment"
                value={comment}
                maxLength={1000}
                rows={4}
                onChange={(e) => setComment(e.target.value)}
                placeholder="The kada finish is beautiful and it paired perfectly with my chaniya choli..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="photo">Add a photo (optional)</Label>
              <label
                htmlFor="photo"
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground transition-colors hover:bg-secondary"
              >
                <Upload size={18} />
                {file ? file.name : "Choose a photo of your purchase"}
              </label>
              <input
                id="photo"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onPickFile}
              />
              {preview && (
                <img
                  src={preview}
                  alt="Preview of the photo you selected"
                  loading="lazy"
                  className="mt-2 h-32 w-32 rounded-xl object-cover"
                />
              )}
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={submit.isPending}>
              {submit.isPending && <Loader2 className="animate-spin" />}
              {submit.isPending ? "Sending..." : "Submit review"}
            </Button>
          </form>
        </section>

        <section>
          <h2 className="text-2xl font-semibold">What shoppers are saying</h2>

          {isLoading && <p className="mt-4 text-sm text-muted-foreground">Loading reviews...</p>}

          {!isLoading && count === 0 && (
            <div className="panel mt-4 p-8 text-center text-sm text-muted-foreground">
              No reviews yet — yours would be the first one.
            </div>
          )}

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {reviews?.map((review) => (
              <article key={review.id} className="panel flex flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold leading-tight">{review.name}</h3>
                    <p className="text-xs uppercase tracking-widest text-primary">
                      {review.product}
                    </p>
                  </div>
                  <Stars value={review.rating} />
                </div>
                <p className="flex gap-2 text-sm text-muted-foreground">
                  <Quote size={16} className="mt-1 shrink-0 text-gold" />
                  <span>{review.comment}</span>
                </p>
                {review.photo && (
                  <img
                    src={review.photo}
                    alt={`Photo shared by ${review.name} of their ${review.product}`}
                    loading="lazy"
                    className="h-48 w-full rounded-xl object-cover"
                  />
                )}
                <p className="text-xs text-muted-foreground/70">
                  {new Date(review.created_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        Made with love for Navratri · handmade in small batches
      </footer>
    </div>
  );
}
