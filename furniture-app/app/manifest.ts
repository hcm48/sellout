import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Clearout",
    short_name: "Clearout",
    description: "Snap it. List it. Move it.",
    start_url: "/",
    display: "standalone",
    background_color: "#F7F5F1",
    theme_color: "#1C1917",
    orientation: "portrait",
    icons: [
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
      { src: "/icon.png", sizes: "32x32", type: "image/png" },
    ],
  };
}
