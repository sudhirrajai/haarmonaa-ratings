import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

// Forward the admin_token cookie from the browser to server function calls
// so that requireAdminAuth middleware can read it from the request headers.
const cookieForwardMiddleware = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    // Cookies are automatically sent with same-origin requests — no manual
    // header injection needed on the client side. The server reads them via
    // getRequest().headers.get("cookie").
    return next({});
  },
);

export const startInstance = createStart(() => ({
  functionMiddleware: [cookieForwardMiddleware],
  requestMiddleware: [errorMiddleware, csrfMiddleware],
}));
