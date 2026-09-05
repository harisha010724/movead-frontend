/** Google's four-colour G, drawn inline so sign-in needs no external asset. */
export function GoogleMark({ className = 'size-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.56-5.17 3.56-8.87z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.94-2.91l-3.88-3a7.2 7.2 0 0 1-10.72-3.78h-4v3.09A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.34 14.31a7.13 7.13 0 0 1 0-4.61v-3.1h-4a12 12 0 0 0 0 10.8l4-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.35 6.6l4 3.1A7.15 7.15 0 0 1 12 4.77z"
      />
    </svg>
  );
}
