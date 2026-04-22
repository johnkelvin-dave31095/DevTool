export function Footer() {
  return (
    <footer className="border-t bg-card px-4 py-4 text-sm text-muted-foreground sm:px-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p>Clockify entries become Outlook events only after rule checks pass.</p>
        <p>Manual review stays on for billable overlaps.</p>
      </div>
    </footer>
  );
}
