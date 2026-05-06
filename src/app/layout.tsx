import "./globals.css";

export const metadata = {
  title: "Pusher",
  description: "公众号图文生成与发布准备"
};

export default function RootLayout({
  children
}: Readonly<{
  children: unknown;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
