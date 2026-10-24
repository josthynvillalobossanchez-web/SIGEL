export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export function pageOf<T>(content: T[], page: number, size: number, total: number): PageResponse<T> {
  return { content, page, size, totalElements: total, totalPages: Math.ceil(total / size) };
}

export function clampPage(page?: string | number, size?: string | number, maxSize = 100) {
  const p = Math.max(Number(page) || 0, 0);
  const s = Math.min(Math.max(Number(size) || 20, 1), maxSize);
  return { page: p, size: s, skip: p * s };
}
