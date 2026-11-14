import { Outlet, ScrollRestoration } from "react-router";
import { AppFooter } from "./AppFooter";
import { AppHeader } from "./AppHeader";

export function RootLayout() {
  return (
    <>
      <AppHeader />
      <main id="main-content">
        <Outlet />
      </main>
      <AppFooter />
      <ScrollRestoration />
    </>
  );
}
