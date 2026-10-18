export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <h1>Public Layout</h1>
      {children}
    </>
  );
}
