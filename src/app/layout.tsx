import "./globals.css";
import AppShell from "../components/navigation/AppShell.tsx";

export const metadata = {
  title: "Pusher 运营工作台",
  description: "公众号图文生成与发布准备"
};

export default function RootLayout({
  children
}: Readonly<{
  children: unknown;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
