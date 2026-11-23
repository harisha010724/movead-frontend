/**
 * Page numbers to show beside "next", with `null` standing for a gap. The first
 * and last page and the current page's neighbours are always there, so a long
 * list stays reachable from either end.
 */
export function pageWindow(page: number, pageCount: number): (number | null)[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);
  const wanted = new Set([1, pageCount, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((n) => wanted.add(n));
  if (page >= pageCount - 2) {
    [pageCount - 3, pageCount - 2, pageCount - 1].forEach((n) => wanted.add(n));
  }
  const sorted = [...wanted].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((n, index) => {
    const previous = sorted[index - 1];
    if (previous !== undefined && n - previous > 1) out.push(null);
    out.push(n);
  });
  return out;
}
