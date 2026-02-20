import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JingleForge — AI Podcast Intro Jingle Maker",
  description:
    "Generate a unique 10–15 second podcast jingle and voice-over script tailored to your show's name, theme, and tone. Powered by Gemini AI and Supabase.",
  keywords: [
    "podcast jingle maker", "AI podcast intro", "podcast branding",
    "Gemini AI audio", "podcast voice-over generator",
  ],
  openGraph: {
    title: "JingleForge — AI Podcast Jingle Maker",
    description: "Create your signature podcast sound in seconds with Gemini AI.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
