import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "饶 & 李 的日程对照表",
  description: "两个人的时间，找到交集",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
