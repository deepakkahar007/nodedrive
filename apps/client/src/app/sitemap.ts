import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.CLIENT_URL;
  if (!siteUrl) return [];

  return [
    {
      url: new URL("/", siteUrl).toString(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
