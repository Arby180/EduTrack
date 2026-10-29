export function Icon({
  name = "school",
  size = 20,
}: {
  name?: string;
  size?: number;
}) {
  const paths: Record<string, string> = {
    school: "M2 8l10-5 10 5-10 5-10-5Zm4 3v6l6 3 6-3v-6M22 8v8",
    home: "m3 10 9-7 9 7v10H3V10Zm6 10v-7h6v7",
    people:
      "M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3M16 4a4 4 0 0 1 0 8M22 21v-3a4 4 0 0 0-3-4M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
    book: "M12 5v16M3 3h5a4 4 0 0 1 4 2 4 4 0 0 1 4-2h5v16h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3V3Z",
    calendar: "M4 5h16v16H4V5Zm0 5h16M8 3v4M16 3v4m-8 8 3 3 5-5",
    chart: "M4 3v18h17M8 17v-5M13 17V7M18 17V4",
    bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4",
    mail: "M3 5h18v14H3V5Zm0 1 9 7 9-7",
    search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
    arrow: "M5 12h14m-5-5 5 5-5 5",
    logout: "M9 3H3v18h6M9 12h12m-5-5 5 5-5 5",
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] ?? paths.school} />
    </svg>
  );
}
