import { createBrowserRouter } from "react-router";
import { RootLayout } from "../components/layout/RootLayout";
import { AboutPage } from "./routes/AboutPage";
import { ExplorePage } from "./routes/ExplorePage";
import { HomePage } from "./routes/HomePage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayout,
    children: [
      { index: true, Component: HomePage },
      { path: "explore", Component: ExplorePage },
      { path: "about", Component: AboutPage },
    ],
  },
]);
