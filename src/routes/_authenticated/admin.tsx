import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, type FormEvent } from "react";
import {
  Loader2, Plus, Trash2, Eye, EyeOff, LogOut,
  CheckCircle, XCircle, Pencil, BarChart3,
  Star, Clock, ThumbsUp, ThumbsDown, Package,
  Search, Filter, X, ShieldCheck,
  Image as ImageIcon, Upload, RotateCcw, ChevronLeft, ChevronRight, Camera,
} from "lucide-react";
import { toast } from "sonner";

import {
  adminGetAllReviews,
  approveReview,
  rejectReview,
  editReview,
  deleteReview,
  getReviewStats,
  approveAllPending,
} from "@/lib/admin-reviews.server";
import {
  adminGetCategories,
  addCategory,
  toggleCategory,
  deleteCategory,
} from "@/lib/admin-categories.server";
import {
  getAutoApprove,
  setAutoApprove,
  getPublicBannerSettings,
  updateBannerSettings,
  resetBannerSettings,
} from "@/lib/admin-settings.server";
import { uploadImage } from "@/lib/upload.server";
import { adminLogout } from "@/lib/admin-auth.server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import heroImage from "@/assets/hero-jewellery.jpg";

/** Read a File as a base64 string */
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

function getPaginationRange(currentPage: number, totalPages: number): (number | string)[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "...", totalPages];
  }
  if (currentPage >= totalPages - 3) {
    return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages];
}

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin Panel | Navratri stall" },
      {
        name: "description",
        content:
          "Manage jewellery items and customer reviews for the Navratri stall.",
      },
    ],
  }),
  component: AdminPage,
});

type ReviewStatus = "pending" | "approved" | "rejected";

type Review = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  product: string;
  rating: number;
  comment: string;
  image_url: string | null;
  status: ReviewStatus;
  created_at: string;
  updated_at: string;
};

type Category = {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};

function StarDisplay({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={13}
          className={n <= value ? "fill-gold text-gold" : "text-muted-foreground/30"}
        />
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: ReviewStatus }) {
  const config = {
    pending: { label: "Pending", className: "bg-amber-500/15 text-amber-600 border-amber-300/30" },
    approved: { label: "Approved", className: "bg-emerald-500/15 text-emerald-600 border-emerald-300/30" },
    rejected: { label: "Rejected", className: "bg-red-500/15 text-red-500 border-red-300/30" },
  };
  const c = config[status];
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${c.className}`}>
      {c.label}
    </span>
  );
}

// ─── Edit Review Modal ────────────────────────────────────────────────────────

function EditReviewModal({
  review,
  onClose,
  onSave,
}: {
  review: Review;
  onClose: () => void;
  onSave: (data: { id: string; comment?: string; rating?: number; name?: string; product?: string }) => void;
}) {
  const [name, setName] = useState(review.name);
  const [comment, setComment] = useState(review.comment);
  const [rating, setRating] = useState(review.rating);
  const [product, setProduct] = useState(review.product);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="panel mx-4 w-full max-w-lg p-6">
        <h3 className="text-xl font-semibold">Edit Review</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Submitted by {review.email} · {new Date(review.created_at).toLocaleDateString("en-IN")}
        </p>

        <div className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Customer Name</Label>
              <Input
                id="edit-name"
                value={name}
                maxLength={100}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-product">Product</Label>
              <Input
                id="edit-product"
                value={product}
                maxLength={80}
                onChange={(e) => setProduct(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Rating</Label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  aria-label={`${n} star`}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    size={28}
                    className={n <= rating ? "fill-gold text-gold" : "text-muted-foreground/30"}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-comment">Review Comment</Label>
            <Textarea
              id="edit-comment"
              value={comment}
              maxLength={1000}
              rows={4}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <Button
            onClick={() =>
              onSave({ id: review.id, name, comment, rating, product })
            }
            className="flex-1"
          >
            Save changes
          </Button>
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Reviews Tab ──────────────────────────────────────────────────────────────

function ReviewsTab() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState<"all" | ReviewStatus>("all");
  const [search, setSearch] = useState("");
  const [ratingFilter, setRatingFilter] = useState<number | undefined>(undefined);
  const [productFilter, setProductFilter] = useState<string>("all");
  const [hasPhotoFilter, setHasPhotoFilter] = useState<boolean | undefined>(undefined);
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "rating_desc" | "rating_asc">("newest");
  const [editingReview, setEditingReview] = useState<Review | null>(null);

  const stats = useQuery({
    queryKey: ["admin-review-stats"],
    queryFn: () => getReviewStats(),
  });

  const categoriesQuery = useQuery({
    queryKey: ["admin-categories"],
    queryFn: () => adminGetCategories(),
  });

  const reviewsQuery = useQuery({
    queryKey: [
      "admin-reviews",
      { page, pageSize, status: statusFilter, search, rating: ratingFilter, product: productFilter, hasPhoto: hasPhotoFilter, sortBy },
    ],
    queryFn: () =>
      adminGetAllReviews({
        data: {
          page,
          pageSize,
          status: statusFilter,
          search: search.trim() || undefined,
          rating: ratingFilter,
          product: productFilter !== "all" ? productFilter : undefined,
          hasPhoto: hasPhotoFilter,
          sortBy,
        },
      }),
  });

  const reviews = reviewsQuery.data?.reviews ?? [];
  const totalCount = reviewsQuery.data?.total ?? 0;
  const totalPages = reviewsQuery.data?.totalPages ?? 1;
  const currentPage = reviewsQuery.data?.page ?? page;
  const startItem = totalCount > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endItem = Math.min(currentPage * pageSize, totalCount);

  const isFiltered = Boolean(
    search.trim() ||
    statusFilter !== "all" ||
    ratingFilter !== undefined ||
    productFilter !== "all" ||
    hasPhotoFilter !== undefined ||
    sortBy !== "newest"
  );

  function resetFilters() {
    setSearch("");
    setStatusFilter("all");
    setRatingFilter(undefined);
    setProductFilter("all");
    setHasPhotoFilter(undefined);
    setSortBy("newest");
    setPage(1);
  }

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-review-stats"] });
    void queryClient.invalidateQueries({ queryKey: ["reviews"] });
  }

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveReview({ data: { id } }),
    onSuccess: () => { toast.success("Review approved"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => rejectReview({ data: { id } }),
    onSuccess: () => { toast.success("Review rejected"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const editMutation = useMutation({
    mutationFn: (data: { id: string; comment?: string; rating?: number; name?: string; product?: string }) =>
      editReview({ data }),
    onSuccess: () => { toast.success("Review updated"); setEditingReview(null); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteReview({ data: { id } }),
    onSuccess: () => { toast.success("Review deleted"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  const autoApproveQuery = useQuery({
    queryKey: ["admin-auto-approve"],
    queryFn: () => getAutoApprove(),
  });

  const toggleAutoApprove = useMutation({
    mutationFn: (enabled: boolean) => setAutoApprove({ data: { enabled } }),
    onSuccess: (res) => {
      toast.success(res.enabled ? "Auto-approve is now ENABLED" : "Auto-approve is now DISABLED");
      void queryClient.invalidateQueries({ queryKey: ["admin-auto-approve"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approveAllMutation = useMutation({
    mutationFn: () => approveAllPending(),
    onSuccess: () => { toast.success("All pending reviews approved!"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      {stats.data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total", value: stats.data.total, icon: BarChart3, color: "text-blue-500" },
            { label: "Pending", value: stats.data.pending, icon: Clock, color: "text-amber-500" },
            { label: "Approved", value: stats.data.approved, icon: ThumbsUp, color: "text-emerald-500" },
            { label: "Rejected", value: stats.data.rejected, icon: ThumbsDown, color: "text-red-500" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="panel flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Icon size={20} className={color} />
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-2xl font-semibold">{value}</p>
                </div>
              </div>
              {label === "Pending" && value > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-amber-500/40 text-amber-500 hover:bg-amber-500/10"
                  onClick={() => approveAllMutation.mutate()}
                  disabled={approveAllMutation.isPending}
                >
                  Approve All
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Avg rating */}
      {stats.data && stats.data.approved > 0 && (
        <div className="panel flex items-center gap-3 p-4">
          <Star size={20} className="fill-gold text-gold" />
          <p className="text-sm">
            Average approved rating:{" "}
            <span className="font-semibold">{stats.data.avgRating.toFixed(1)} / 5</span>
            {" "}from {stats.data.approved} approved {stats.data.approved === 1 ? "review" : "reviews"}
          </p>
        </div>
      )}

      {/* Auto-Approve Setting Card */}
      <div className="panel flex flex-wrap items-center justify-between gap-3 p-4 border-primary/30">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary border border-primary/20">
            <ShieldCheck size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">Auto-Approve New Reviews</span>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${autoApproveQuery.data?.enabled ? "bg-emerald-500/20 text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                {autoApproveQuery.data?.enabled ? "Active (Auto-Publish)" : "Manual Approval Required"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {autoApproveQuery.data?.enabled
                ? "Reviews and photos posted by customers are published immediately on the website."
                : "New reviews will be held in 'Pending' until you click Approve."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="auto-approve-toggle"
            checked={autoApproveQuery.data?.enabled ?? true}
            disabled={toggleAutoApprove.isPending}
            onCheckedChange={(checked) => toggleAutoApprove.mutate(checked)}
          />
        </div>
      </div>

      {/* Backend Filters Panel */}
      <div className="panel p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(["all", "pending", "approved", "rejected"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setStatusFilter(s);
                  setPage(1);
                }}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-medium capitalize transition-colors ${
                  statusFilter === s
                    ? "border-primary bg-primary text-primary-foreground font-semibold"
                    : "border-border text-muted-foreground hover:bg-secondary"
                }`}
              >
                {s}
                {s === "pending" && stats.data?.pending ? ` (${stats.data.pending})` : ""}
              </button>
            ))}
          </div>

          {isFiltered && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1.5"
            >
              <RotateCcw size={13} />
              Reset filters
            </Button>
          )}
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
          {/* Search */}
          <div className="relative lg:col-span-2">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="review-search"
              placeholder="Search name, email, phone, comment…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-8 text-xs h-9 bg-background/50"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Product Category Filter */}
          <div>
            <select
              value={productFilter}
              onChange={(e) => {
                setProductFilter(e.target.value);
                setPage(1);
              }}
              className="h-9 w-full rounded-lg border border-border bg-background/50 px-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
              aria-label="Filter by jewellery item"
            >
              <option value="all">All Jewellery Items</option>
              {categoriesQuery.data?.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Rating Filter */}
          <div>
            <select
              value={ratingFilter !== undefined ? String(ratingFilter) : "all"}
              onChange={(e) => {
                setRatingFilter(e.target.value === "all" ? undefined : Number(e.target.value));
                setPage(1);
              }}
              className="h-9 w-full rounded-lg border border-border bg-background/50 px-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
              aria-label="Filter by rating"
            >
              <option value="all">All Star Ratings</option>
              <option value="5">⭐⭐⭐⭐⭐ (5 stars)</option>
              <option value="4">⭐⭐⭐⭐ (4 stars)</option>
              <option value="3">⭐⭐⭐ (3 stars)</option>
              <option value="2">⭐⭐ (2 stars)</option>
              <option value="1">⭐ (1 star)</option>
            </select>
          </div>

          {/* Sort Filter */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as any);
                setPage(1);
              }}
              className="h-9 w-full rounded-lg border border-border bg-background/50 px-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
              aria-label="Sort reviews"
            >
              <option value="newest">Sort: Newest</option>
              <option value="oldest">Sort: Oldest</option>
              <option value="rating_desc">Sort: Highest Rated</option>
              <option value="rating_asc">Sort: Lowest Rated</option>
            </select>
          </div>
        </div>
      </div>

      {/* Showing count banner */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>
          {totalCount > 0
            ? `Showing ${startItem}–${endItem} of ${totalCount} reviews`
            : "No reviews found"}
        </span>
        {isFiltered && <span className="italic text-primary/80">Filtered results</span>}
      </div>

      {/* Review list */}
      {reviewsQuery.isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-muted-foreground" size={24} />
        </div>
      )}

      {!reviewsQuery.isLoading && reviews.length === 0 && (
        <div className="panel p-8 text-center text-sm text-muted-foreground">
          {isFiltered ? "No reviews match your filter criteria." : "No reviews in this category yet."}
          {isFiltered && (
            <div className="mt-3">
              <Button variant="outline" size="sm" onClick={resetFilters} className="text-xs">
                Reset filters
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        {reviews.map((review) => (
          <div key={review.id} className="panel overflow-hidden">
            <div className="flex flex-wrap items-start gap-3 border-b border-border/50 px-4 py-3">
              {/* Header */}
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{review.name}</span>
                  <StatusBadge status={review.status as ReviewStatus} />
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    {review.product}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {review.email}
                  {review.phone && ` · ${review.phone}`}
                  {" · "}
                  {new Date(review.created_at).toLocaleDateString("en-IN", {
                    day: "numeric", month: "short", year: "numeric",
                  })}
                </p>
              </div>
              <StarDisplay value={review.rating} />
            </div>

            <div className="px-4 py-3">
              <p className="text-sm text-muted-foreground leading-relaxed">{review.comment}</p>
              {review.image_url && (
                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setLightboxImg(review.image_url)}
                    className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-primary/30 shadow-md transition-all hover:border-primary focus:outline-none"
                  >
                    <img
                      src={review.image_url}
                      alt={`Photo by ${review.name}`}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                    />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                      <Eye size={20} className="text-white drop-shadow" />
                    </span>
                  </button>
                  <div>
                    <span className="text-xs font-semibold text-foreground">Attached Photo</span>
                    <p className="text-[11px] text-muted-foreground">Click the thumbnail to view full resolution</p>
                    <button
                      type="button"
                      onClick={() => setLightboxImg(review.image_url)}
                      className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-secondary/50 px-2.5 py-0.5 text-xs text-primary transition-colors hover:bg-secondary hover:underline"
                    >
                      <Eye size={12} /> View Full Image
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-1.5 border-t border-border/50 px-4 py-2.5">
              {review.status !== "approved" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1.5 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                  onClick={() => approveMutation.mutate(review.id)}
                  disabled={approveMutation.isPending}
                  aria-label={`Approve ${review.name}'s review`}
                >
                  <CheckCircle size={14} />
                  Approve
                </Button>
              )}
              {review.status !== "rejected" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1.5 text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                  onClick={() => rejectMutation.mutate(review.id)}
                  disabled={rejectMutation.isPending}
                  aria-label={`Reject ${review.name}'s review`}
                >
                  <XCircle size={14} />
                  {review.status === "approved" ? "Disapprove" : "Reject"}
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-1.5 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                onClick={() => setEditingReview(review as Review)}
                aria-label={`Edit ${review.name}'s review`}
              >
                <Pencil size={14} />
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-1.5 hover:bg-destructive/10"
                onClick={() => {
                  if (confirm(`Delete ${review.name}'s review? This cannot be undone.`)) {
                    deleteMutation.mutate(review.id);
                  }
                }}
                disabled={deleteMutation.isPending}
                aria-label={`Delete ${review.name}'s review`}
              >
                <Trash2 size={14} className="text-destructive" />
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Admin Pagination Controls */}
      {totalCount > 0 && (
        <div className="panel p-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              Showing <span className="font-semibold text-foreground">{startItem}</span> to{" "}
              <span className="font-semibold text-foreground">{endItem}</span> of{" "}
              <span className="font-semibold text-foreground">{totalCount}</span> reviews
            </span>
            <div className="flex items-center gap-1.5 border-l border-border/60 pl-3">
              <span>Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="h-7 rounded border border-border bg-background px-2 text-xs text-foreground focus:border-primary focus:outline-none"
                aria-label="Reviews per page"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage <= 1 || reviewsQuery.isFetching}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-8 px-2.5 text-xs gap-1"
                aria-label="Previous page"
              >
                <ChevronLeft size={14} />
                <span className="hidden sm:inline">Prev</span>
              </Button>

              {getPaginationRange(currentPage, totalPages).map((p, idx) =>
                typeof p === "number" ? (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPage(p)}
                    disabled={reviewsQuery.isFetching}
                    className={`h-8 min-w-8 rounded-md px-2 text-xs font-medium transition-all ${
                      currentPage === p
                        ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                        : "border border-border/80 bg-background text-muted-foreground hover:border-primary/50 hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    {p}
                  </button>
                ) : (
                  <span key={idx} className="px-1 text-xs text-muted-foreground">
                    …
                  </span>
                )
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages || reviewsQuery.isFetching}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="h-8 px-2.5 text-xs gap-1"
                aria-label="Next page"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight size={14} />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Edit modal */}
      {editingReview && (
        <EditReviewModal
          review={editingReview}
          onClose={() => setEditingReview(null)}
          onSave={(data) => editMutation.mutate(data)}
        />
      )}

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
              alt="Review photo"
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
    </div>
  );
}

// ─── Hero Banner Tab ────────────────────────────────────────────────────────

function BannerTab() {
  const queryClient = useQueryClient();
  const bannerQuery = useQuery({
    queryKey: ["admin-banner-settings"],
    queryFn: () => getPublicBannerSettings(),
  });

  const [imageUrl, setImageUrl] = useState("");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (bannerQuery.data) {
      setImageUrl(bannerQuery.data.imageUrl || "");
      setTitle(bannerQuery.data.title || "");
      setSubtitle(bannerQuery.data.subtitle || "");
    }
  }, [bannerQuery.data]);

  const updateBanner = useMutation({
    mutationFn: async () => {
      let finalUrl = imageUrl.trim();

      if (file) {
        setIsUploading(true);
        const base64 = await fileToBase64(file);
        const res = await uploadImage({
          data: {
            base64,
            mimeType: (file.type || "image/jpeg") as any,
            filename: file.name,
          },
        });
        finalUrl = res.url;
        setImageUrl(finalUrl);
        setFile(null);
        setPreview(null);
      }

      await updateBannerSettings({
        data: {
          imageUrl: finalUrl || null,
          title: title.trim() || null,
          subtitle: subtitle.trim() || null,
        },
      });
    },
    onSuccess: () => {
      setIsUploading(false);
      toast.success("Hero banner updated successfully!");
      void queryClient.invalidateQueries({ queryKey: ["admin-banner-settings"] });
      void queryClient.invalidateQueries({ queryKey: ["public-banner-settings"] });
    },
    onError: (e: Error) => {
      setIsUploading(false);
      toast.error(e.message || "Failed to update banner");
    },
  });

  const resetBanner = useMutation({
    mutationFn: () => resetBannerSettings(),
    onSuccess: () => {
      setImageUrl("");
      setTitle("");
      setSubtitle("");
      setFile(null);
      setPreview(null);
      toast.success("Banner reset to default image!");
      void queryClient.invalidateQueries({ queryKey: ["admin-banner-settings"] });
      void queryClient.invalidateQueries({ queryKey: ["public-banner-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onPickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0] ?? null;
    if (picked && picked.size > 10 * 1024 * 1024) {
      toast.error("File is larger than 10 MB. Please pick a smaller image.");
      return;
    }
    setFile(picked);
    setPreview(picked ? URL.createObjectURL(picked) : null);
  }

  const activeDisplayImg = preview || imageUrl || heroImage;

  return (
    <div className="space-y-6">
      {/* Live Preview Panel */}
      <div className="panel overflow-hidden border-primary/30 shadow-md">
        <div className="border-b border-border/60 bg-muted/40 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ImageIcon size={16} className="text-primary" />
            <span className="text-sm font-semibold">Homepage Hero Banner Live Preview</span>
          </div>
          {imageUrl ? (
            <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 text-[11px]">
              Custom Banner Active
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground text-[11px]">
              Default Banner
            </Badge>
          )}
        </div>

        <div className="relative h-60 sm:h-72 w-full overflow-hidden bg-background">
          <img
            src={activeDisplayImg}
            alt="Hero banner preview"
            className="h-full w-full object-cover transition-all"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/20" />
          <div className="absolute inset-x-0 bottom-0 p-6 text-center">
            <p className="text-[10px] uppercase tracking-[0.3em] text-primary font-medium">
              Haarmonaa · Luxury Handmade Jewellery
            </p>
            <h3 className="mt-1 text-2xl font-semibold sm:text-3xl">
              {title.trim() ? (
                title
              ) : (
                <>
                  <span className="text-gradient-gold">Customer</span> Reviews & Ratings
                </>
              )}
            </h3>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground truncate sm:whitespace-normal">
              {subtitle.trim() ||
                "Handcrafted with elegance, devotion, and beauty. Tell us about your jewellery piece and share a photo wearing it."}
            </p>
          </div>
        </div>
      </div>

      {/* Banner Edit Form */}
      <div className="panel p-5 sm:p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Update Banner Media</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Upload a banner photo from your computer or enter an image URL.
            </p>
          </div>
          {(imageUrl || title || subtitle) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (confirm("Reset banner back to the default image and text?")) {
                  resetBanner.mutate();
                }
              }}
              disabled={resetBanner.isPending}
              className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
            >
              <RotateCcw size={13} className="mr-1.5" />
              Reset to Default
            </Button>
          )}
        </div>

        {/* Upload file input */}
        <div className="space-y-2">
          <Label className="text-xs sm:text-sm font-medium">Upload New Banner Photo</Label>
          {!preview ? (
            <label
              htmlFor="banner-file"
              className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-background/40 p-6 text-center text-xs text-muted-foreground transition-all hover:border-primary/50 hover:bg-secondary/40"
            >
              <Upload size={24} className="mb-2 text-primary" />
              <span className="font-medium text-foreground">Click or tap to upload banner image</span>
              <span className="text-[11px] text-muted-foreground mt-0.5">
                Recommended 1600×900 or 1920×1080 (max 10 MB)
              </span>
            </label>
          ) : (
            <div className="relative inline-block">
              <img
                src={preview}
                alt="Selected banner"
                className="h-32 w-56 rounded-xl object-cover border border-primary/30 shadow-md"
              />
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  setPreview(null);
                }}
                className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-md transition-transform hover:scale-110"
                aria-label="Remove uploaded image"
              >
                <X size={14} />
              </button>
              <p className="mt-1 text-xs text-muted-foreground truncate max-w-xs">{file?.name}</p>
            </div>
          )}
          <input
            id="banner-file"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPickFile}
          />
        </div>

        {/* Or direct image URL */}
        <div className="space-y-1.5">
          <Label htmlFor="banner-url" className="text-xs sm:text-sm">Or Direct Image URL</Label>
          <Input
            id="banner-url"
            value={imageUrl}
            onChange={(e) => {
              setImageUrl(e.target.value);
              if (file) {
                setFile(null);
                setPreview(null);
              }
            }}
            placeholder="https://example.com/banner.jpg or /uploads/custom-banner.jpg"
            className="text-xs sm:text-sm bg-background/50"
          />
        </div>

        {/* Banner Title */}
        <div className="space-y-1.5">
          <Label htmlFor="banner-title" className="text-xs sm:text-sm">
            Banner Heading (Optional)
          </Label>
          <Input
            id="banner-title"
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Customer Reviews & Ratings (Leave empty for default)"
            className="text-xs sm:text-sm bg-background/50"
          />
        </div>

        {/* Banner Subtitle */}
        <div className="space-y-1.5">
          <Label htmlFor="banner-subtitle" className="text-xs sm:text-sm">
            Banner Subtitle (Optional)
          </Label>
          <Textarea
            id="banner-subtitle"
            value={subtitle}
            maxLength={500}
            rows={2}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="Handcrafted with elegance, devotion, and beauty... (Leave empty for default)"
            className="text-xs sm:text-sm bg-background/50"
          />
        </div>

        <div className="pt-2">
          <Button
            type="button"
            size="lg"
            onClick={() => updateBanner.mutate()}
            disabled={updateBanner.isPending || isUploading}
            className="w-full sm:w-auto font-medium px-8"
          >
            {(updateBanner.isPending || isUploading) && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {updateBanner.isPending || isUploading ? "Saving Banner..." : "Save Banner Settings"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Categories Tab ───────────────────────────────────────────────────────────

function CategoriesTab() {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");

  const categories = useQuery({
    queryKey: ["admin-categories"],
    queryFn: () => adminGetCategories(),
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
    void queryClient.invalidateQueries({ queryKey: ["categories"] });
  }

  const add = useMutation({
    mutationFn: () => addCategory({ data: { name: newName.trim() } }),
    onSuccess: () => { setNewName(""); toast.success("Item added"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: (cat: Category) =>
      toggleCategory({ data: { id: cat.id, is_active: !cat.is_active } }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteCategory({ data: { id } }),
    onSuccess: () => { toast.success("Item removed"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  function onAdd(event: FormEvent) {
    event.preventDefault();
    if (!newName.trim()) return;
    add.mutate();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        These are the choices shoppers tap on the review form. Hidden items stay on old reviews but
        are no longer offered.
      </p>

      <form onSubmit={onAdd} className="panel flex flex-col gap-3 p-5 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="new-item">Add an item</Label>
          <Input
            id="new-item"
            value={newName}
            maxLength={80}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Oxidised pendant"
          />
        </div>
        <Button type="submit" disabled={add.isPending}>
          {add.isPending ? <Loader2 className="animate-spin" /> : <Plus size={16} />} Add
        </Button>
      </form>

      <div className="space-y-2">
        {categories.isLoading && <p className="text-sm text-muted-foreground">Loading items...</p>}
        {categories.data?.map((category) => (
          <div
            key={category.id}
            className="panel flex items-center justify-between gap-3 px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <Package size={14} className="text-muted-foreground" />
              <span className={category.is_active ? "" : "text-muted-foreground line-through"}>
                {category.name}
              </span>
              {!category.is_active && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  Hidden
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggle.mutate(category as Category)}
                aria-label={category.is_active ? `Hide ${category.name}` : `Show ${category.name}`}
              >
                {category.is_active ? <Eye size={16} /> : <EyeOff size={16} />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => remove.mutate(category.id)}
                aria-label={`Remove ${category.name}`}
              >
                <Trash2 size={16} className="text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Admin Page ───────────────────────────────────────────────────────────────

function AdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"reviews" | "banner" | "items">("reviews");

  const stats = useQuery({
    queryKey: ["admin-review-stats"],
    queryFn: () => getReviewStats(),
  });

  async function signOut() {
    try {
      // Server function clears the httpOnly cookie via Set-Cookie response header
      await adminLogout();
    } catch {
      // ignore
    }
    void queryClient.cancelQueries();
    queryClient.clear();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <img
            src="/logo-circle.png"
            alt="Haarmonaa"
            className="h-12 w-12 rounded-full border-2 border-primary/40 shadow-sm"
          />
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-primary">Haarmonaa Admin</p>
            <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
              <span className="text-gradient-gold">Review</span> & Inventory Management
            </h1>
          </div>
        </div>
        <Button variant="secondary" onClick={signOut}>
          <LogOut size={16} /> Sign out
        </Button>
      </div>

      {/* Tabs */}
      <div className="mt-7 flex gap-1 rounded-xl border border-border bg-card/50 p-1">
        <button
          onClick={() => setActiveTab("reviews")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "reviews"
              ? "bg-background shadow-sm text-foreground font-semibold"
              : "text-muted-foreground hover:text-foreground"
          }`}
          id="tab-reviews"
        >
          <Star size={15} />
          Reviews
          {stats.data?.pending ? (
            <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
              {stats.data.pending}
            </span>
          ) : null}
        </button>
        <button
          onClick={() => setActiveTab("banner")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "banner"
              ? "bg-background shadow-sm text-foreground font-semibold"
              : "text-muted-foreground hover:text-foreground"
          }`}
          id="tab-banner"
        >
          <ImageIcon size={15} />
          Hero Banner
        </button>
        <button
          onClick={() => setActiveTab("items")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "items"
              ? "bg-background shadow-sm text-foreground font-semibold"
              : "text-muted-foreground hover:text-foreground"
          }`}
          id="tab-items"
        >
          <Package size={15} />
          Jewellery Items
        </button>
      </div>

      <div className="mt-6">
        {activeTab === "reviews" && <ReviewsTab />}
        {activeTab === "banner" && <BannerTab />}
        {activeTab === "items" && <CategoriesTab />}
      </div>

      <Link to="/" className="mt-8 inline-block text-sm text-muted-foreground hover:underline">
        ← Back to the review page
      </Link>
    </div>
  );
}
