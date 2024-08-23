import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Head from "next/head";

const inter = Inter({ subsets: ["latin"] });

// export const metadata: Metadata = {
//   title: "Checkmate",
//   description: "Community chess on blinks.",
//   openGraph: {
//     title: "Checkmate",
//     description: "Community chess on blinks.",
//     url: "https://checkmate.sendarcade.fun",
//     images: [
//       {
//         url: "/newog.jpg",
//         width: 1200,
//         height: 630,
//         alt: "Checkmate OG Image",
//       },
//     ],
//     type: "website",
//   },
// };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* HTML Meta Tags */}
        <title>Checkmate</title>
        <meta name="description" content="Community chess on blinks." />

        {/* Facebook Meta Tags */}
        <meta property="og:url" content="https://checkmate.sendarcade.fun" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Checkmate" />
        <meta property="og:description" content="Community chess on blinks." />
        <meta
          property="og:image"
          content="https://checkmate.sendarcade.fun/newog.jpg"
        />

        {/* Twitter Meta Tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta property="twitter:domain" content="checkmate.sendarcade.fun" />
        <meta property="twitter:url" content="https://checkmate.sendarcade.fun" />
        <meta name="twitter:title" content="Checkmate" />
        <meta name="twitter:description" content="Community chess on blinks." />
        <meta
          name="twitter:image"
          content="https://checkmate.sendarcade.fun/newog.jpg"
        />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
