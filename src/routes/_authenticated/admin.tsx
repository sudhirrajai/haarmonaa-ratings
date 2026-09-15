import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import {
  Loader2, Plus, Trash2, Eye, EyeOff, LogOut,
  CheckCircle, XCircle, Pencil, BarChart3,
  Star, Clock, ThumbsUp, ThumbsDown, Package,
  Search, Filter,
} from "lucide-react";
import { toast } from "sonner";

import {
  adminGetAllReviews,
  approveReview,
  rejectReview,
  editReview,
  deleteReview,
  getReviewStats,
} from "@/lib/admin-reviews.server";
import {
  adminGetCategories,
  addCategory,
  toggleCategory,
  deleteCategory,
} from "@/lib/admin-categories.server";
import { adminLogout } from "@/lib/admin-auth.server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

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
  const [statusFilter, setStatusFilter] = useState<"all" | ReviewStatus>("all");
  const [search, setSearch] = useState("");
  const [editingReview, setEditingReview] = useState<Review | null>(null);

  const stats = useQuery({
    queryKey: ["admin-review-stats"],
    queryFn: () => getReviewStats(),
  });

  const reviewsQuery = useQuery({
    queryKey: ["admin-reviews", statusFilter],
    queryFn: () => adminGetAllReviews({ data: { status: statusFilter } }),
  });

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

  const filtered = (reviewsQuery.data ?? []).filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      r.comment.toLowerCase().includes(q) ||
      r.product.toLowerCase().includes(q)
    );
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
            <div key={label} className="panel flex items-center gap-3 p-4">
              <Icon size={20} className={color} />
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-2xl font-semibold">{value}</p>
              </div>
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

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="review-search"
            placeholder="Search by name, email, product…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1.5">
          {(["all", "pending", "approved", "rejected"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-medium capitalize transition-colors ${
                statusFilter === s
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-secondary"
              }`}
            >
              {s}
              {s === "pending" && stats.data?.pending
                ? ` (${stats.data.pending})`
                : ""}
            </button>
          ))}
        </div>
      </div>

      {/* Review list */}
      {reviewsQuery.isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-muted-foreground" size={24} />
        </div>
      )}

      {!reviewsQuery.isLoading && filtered.length === 0 && (
        <div className="panel p-8 text-center text-sm text-muted-foreground">
          {search ? "No reviews match your search." : "No reviews in this category yet."}
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((review) => (
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
                <p className="mt-2 text-xs text-muted-foreground/60">📷 Photo attached</p>
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

      {/* Edit modal */}
      {editingReview && (
        <EditReviewModal
          review={editingReview}
          onClose={() => setEditingReview(null)}
          onSave={(data) => editMutation.mutate(data)}
        />
      )}
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
  const [activeTab, setActiveTab] = useState<"reviews" | "items">("reviews");

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
              ? "bg-background shadow-sm text-foreground"
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
          onClick={() => setActiveTab("items")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "items"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          id="tab-items"
        >
          <Package size={15} />
          Jewellery Items
        </button>
      </div>

      <div className="mt-6">
        {activeTab === "reviews" ? <ReviewsTab /> : <CategoriesTab />}
      </div>

      <Link to="/" className="mt-8 inline-block text-sm text-muted-foreground hover:underline">
        ← Back to the review page
      </Link>
    </div>
  );
}
