import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.CLIENT_URL;

  return {
    rules: { userAgent: "*", allow: "/", disallow: "/dashboard" },
    ...(siteUrl
      ? { sitemap: new URL("/sitemap.xml", siteUrl).toString() }
      : {}),
  };
}
