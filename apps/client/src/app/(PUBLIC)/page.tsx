import type { Metadata } from "next";
import { LandingPage } from "@/components/dashboard/landing-page";

const siteUrl = process.env.CLIENT_URL;
const socialImage = siteUrl ? new URL("/og", siteUrl).toString() : undefined;

export const metadata: Metadata = {
  metadataBase: siteUrl ? new URL(siteUrl) : undefined,
  title: "Shared storage for teams",
  description:
    "Upload, organize, and share team files from one simple workspace.",
  ...(siteUrl ? { alternates: { canonical: "/" } } : {}),
  openGraph: {
    type: "website",
    siteName: "NodeDrive",
    title: "Shared storage for teams | NodeDrive",
    description:
      "Upload, organize, and share team files from one simple workspace.",
    ...(siteUrl ? { url: new URL("/", siteUrl).toString() } : {}),
    ...(socialImage
      ? {
          images: [
            { url: socialImage, alt: "NodeDrive shared team workspace" },
          ],
        }
      : {}),
  },
  twitter: {
    card: "summary_large_image",
    title: "Shared storage for teams | NodeDrive",
    description:
      "Upload, organize, and share team files from one simple workspace.",
    ...(socialImage ? { images: [socialImage] } : {}),
  },
};

export default function Home() {
  const structuredData = siteUrl
    ? {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "NodeDrive",
        url: siteUrl,
        description:
          "Shared cloud storage for teams to organize and share files.",
      }
    : null;

  return (
    <>
      {structuredData ? (
        <script type="application/ld+json">
          {JSON.stringify(structuredData).replace(/</g, "\\u003c")}
        </script>
      ) : null}
      <LandingPage />
    </>
  );
}
