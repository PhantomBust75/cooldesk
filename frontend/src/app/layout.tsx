import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { AppProviders } from "@/components/providers/app-providers";
import Script from "next/script";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Cool Desk",
  description: "Operational portal for AC service organizations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${mono.variable} h-full`}
    >
      <body>
        <Script id="strip-extension-attrs" strategy="beforeInteractive">
          {`(function () {
  var targets = ['data-new-gr-c-s-check-loaded', 'data-gr-ext-installed'];
  function normalize() {
    if (!document.body) return;
    for (var i = 0; i < targets.length; i += 1) {
      document.body.removeAttribute(targets[i]);
    }
  }
  normalize();
  var timer = window.setInterval(function () {
    normalize();
  }, 50);
  var stop = function () {
    window.clearInterval(timer);
    if (observer) observer.disconnect();
  };
  var observer = document.body
    ? new MutationObserver(normalize)
    : null;
  if (observer && document.body) {
    observer.observe(document.body, { attributes: true, attributeFilter: targets });
  }
  window.setTimeout(stop, 2000);
})();`}
        </Script>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
