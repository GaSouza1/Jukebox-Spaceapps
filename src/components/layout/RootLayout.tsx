import { useEffect, useRef } from "react";
import { Outlet, ScrollRestoration, useLocation } from "react-router";
import { AppFooter } from "./AppFooter";
import { AppHeader } from "./AppHeader";
import { ScreenReaderGuide } from "../../features/guided-experience/components/ScreenReaderGuide";

const APP_NAME = "Earth Information Jukebox";
const PAGE_TITLES: Record<string, string> = {
  "/": `${APP_NAME} · Compare Earth data through sound`,
  "/explore": `Explore · ${APP_NAME}`,
  "/about": `About and methodology · ${APP_NAME}`,
};

/**
 * Gives each route a unique title and, after client-side navigation, moves focus
 * to the new page's main heading so screen readers announce the new page.
 */
function useRouteAnnouncement() {
  const { pathname } = useLocation();
  const isFirstRender = useRef(true);

  useEffect(() => {
    document.title = PAGE_TITLES[pathname] ?? APP_NAME;
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const heading = document.querySelector<HTMLElement>("#main-content h1");
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }, [pathname]);
}

export function RootLayout() {
  useRouteAnnouncement();
  return (
    <>
      <AppHeader />
      {/* Visually hidden until focused; available on every page (see the guide's README). */}
      <ScreenReaderGuide />
      <main id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
      <AppFooter />
      <ScrollRestoration />
    </>
  );
}
