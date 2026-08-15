import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Messages",
  manifest: "/manifest.json?v=3",
};

export default function MessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
