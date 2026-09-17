const PATHS = {
  login: 'M11 16l-4-4m0 0l4-4m-4 4h14m-9 9v2a2 2 0 002 2h6a2 2 0 002-2V5a2 2 0 00-2-2h-6a2 2 0 00-2 2v2',
  logout: 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4m7 14l5-5-5-5m5 5H9',
  lock: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4',
  key: 'M15 7a4 4 0 11-8 0 4 4 0 018 0zm-3.5 3.5L4 18v2h3l1-1h2v-2h2l1.5-1.5',
  mail: 'M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zm0 2l8 6 8-6',
  check: 'M20 6L9 17l-5-5',
  x: 'M18 6L6 18M6 6l12 12',
  trash: 'M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z',
  save: 'M17 21v-8H7v8M7 3v5h8M5 3h11l3 3v15a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z',
  plus: 'M12 5v14m-7-7h14',
  search: 'M21 21l-4.3-4.3M17 10a7 7 0 11-14 0 7 7 0 0114 0z',
  user: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7v1h14v-1a7 7 0 00-7-7z',
  users: 'M17 20h5v-1a4 4 0 00-3-3.87M9 20H4v-1a4 4 0 013-3.87M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 4a2 2 0 11-4 0 2 2 0 014 0zM7 11a2 2 0 11-4 0 2 2 0 014 0z',
  help: 'M12 8a3 3 0 113 3 2 2 0 01-1 1.7V16m0 4v.01M12 3a9 9 0 100 18 9 9 0 000-18z',
  warning: 'M12 3l10 18H2L12 3zm0 7v4m0 3v.01',
  info: 'M12 11v5m0-9v.01M12 3a9 9 0 100 18 9 9 0 000-18z',
  calendar: 'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z',
  clock: 'M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z',
  refresh: 'M4 4v5h5M20 20v-5h-5M20 9A8 8 0 006 5.3L4 9m0-5h5m11 16h-5',
  arrowRight: 'M5 12h14m0 0l-6-6m6 6l-6 6',
  arrowLeft: 'M19 12H5m0 0l6-6m-6 6l6 6',
  download: 'M12 3v12m0 0l-4-4m4 4l4-4M5 21h14',
  upload: 'M12 21V9m0 0l-4 4m4-4l4 4M5 3h14',
  swap: 'M8 3l-4 4m4-4l4 4M4 7h14m-2 14l4-4m-4 4l-4-4M20 17H6',
  send: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',
  shield: 'M12 2l9 5v5c0 5.5-3.8 9.7-9 11-5.2-1.3-9-5.5-9-11V7l9-5z',
  chart: 'M4 20V10m6 10V4m6 16v-7'
};

export default function Icon({ name, size = 18, strokeWidth = 2, className }) {
  const d = PATHS[name];
  if (!d) return null;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      focusable="false"
    >
      <path
        d={d}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}