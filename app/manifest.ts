import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Notescape",
    short_name: "Notescape",
    description: "A polished workspace for notes, tasks, and planning.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#09090b",
    theme_color: "#09090b",
    categories: ["productivity", "utilities"],
    icons: [
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Open notes",
        short_name: "Notes",
        description: "Open your notes workspace",
        url: "/?view=notes",
        icons: [{ src: "/icons/icon-192.svg", sizes: "192x192", type: "image/svg+xml" }],
      },
      {
        name: "Open tasks",
        short_name: "Tasks",
        description: "Open your task board",
        url: "/?view=tasks",
        icons: [{ src: "/icons/icon-192.svg", sizes: "192x192", type: "image/svg+xml" }],
      },
    ],
  };
}
