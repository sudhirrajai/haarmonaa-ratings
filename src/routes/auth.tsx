import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

import { adminLogin } from "@/lib/admin-auth.server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Stall owner sign in | Navratri jewellery reviews" },
      {
        name: "description",
        content:
          "Sign in to manage the list of jewellery items shoppers can pick when leaving a review.",
      },
      { property: "og:title", content: "Stall owner sign in" },
      {
        property: "og:description",
        content: "Sign in to manage the jewellery items shown on the review form.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      // The server function sets the httpOnly cookie via Set-Cookie response header
      await adminLogin({ data: { email: email.trim(), password } });
      navigate({ to: "/admin", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
      <div className="panel p-7">
        <div className="mb-6 flex flex-col items-center justify-center">
          <img
            src="/logo-circle.png"
            alt="Haarmonaa"
            className="h-16 w-16 rounded-full border-2 border-primary/40 shadow-glow p-0.5 bg-card"
          />
          <span className="mt-3 font-serif text-lg tracking-[0.25em] font-semibold text-foreground">
            HAARMONAA
          </span>
        </div>
        <h1 className="text-center text-2xl font-semibold">
          <span className="text-gradient-gold">Admin</span> Sign In
        </h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Sign in to manage jewellery items and customer reviews.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={1}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            {busy ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
