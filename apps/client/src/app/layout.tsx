import type { Metadata } from "next";
import { Geist, Poppins } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});

const siteUrl = process.env.CLIENT_URL;
const socialImage = siteUrl ? new URL("/og", siteUrl).toString() : undefined;

export const metadata: Metadata = {
  metadataBase: siteUrl ? new URL(siteUrl) : undefined,
  title: {
    default: "NodeDrive | Shared cloud storage for teams",
    template: "%s | NodeDrive",
  },
  description:
    "Keep your team's files organized, accessible, and easy to share with NodeDrive.",
  applicationName: "NodeDrive",
  openGraph: {
    type: "website",
    siteName: "NodeDrive",
    title: "NodeDrive | Shared cloud storage for teams",
    description:
      "Keep your team's files organized, accessible, and easy to share with NodeDrive.",
    ...(siteUrl ? { url: siteUrl } : {}),
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
    title: "NodeDrive | Shared cloud storage for teams",
    description:
      "Keep your team's files organized, accessible, and easy to share with NodeDrive.",
    ...(socialImage ? { images: [socialImage] } : {}),
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        poppins.variable,
        "font-sans",
        geist.variable,
      )}
    >
      <body className="">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
