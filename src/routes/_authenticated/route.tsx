import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { checkAdminSession } from "@/lib/admin-auth.server";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    try {
      const session = await checkAdminSession();
      return { adminId: session.adminId };
    } catch {
      throw redirect({ to: "/auth" });
    }
  },
  component: () => <Outlet />,
});
