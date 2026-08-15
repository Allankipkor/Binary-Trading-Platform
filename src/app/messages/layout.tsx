import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Messages",
  manifest: "/manifest.json?v=5",
};

export default function MessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
