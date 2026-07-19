export default function AppRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="flex flex-col min-h-full">{children}</div>;
}
