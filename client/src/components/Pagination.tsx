/**
 * D-Fence — Pagination component and hook (/better-ui compliant).
 * Conforms to touch-target standards (min 44px), ARIA navigation rules,
 * layered shadows, concentric radii, and active-state scaling.
 */
import { useMemo, useState, useEffect } from 'react';

export interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  itemName?: string;
  className?: string;
}

export function Pagination(props: PaginationProps): JSX.Element | null {
  const { currentPage, totalItems, pageSize, onPageChange, itemName = 'items', className = '' } = props;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  if (totalItems === 0) {
    return null;
  }

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Generate visible page numbers with ellipsis if needed
  const pageNumbers = useMemo(() => {
    const pages: Array<number | '...'> = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i += 1) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      if (currentPage > 3) {
        pages.push('...');
      }
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i += 1) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) {
        pages.push('...');
      }
      pages.push(totalPages);
    }
    return pages;
  }, [currentPage, totalPages]);

  return (
    <nav
      role="navigation"
      aria-label="Pagination"
      className={`pagination-container ${className}`}
      data-component="pagination"
    >
      <div className="pagination-summary" aria-live="polite">
        Showing <strong>{startItem}</strong>–<strong>{endItem}</strong> of <strong>{totalItems}</strong> {itemName}
      </div>

      <div className="pagination-controls">
        <button
          type="button"
          className="pagination-btn pagination-prev"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="Go to previous page"
        >
          <span aria-hidden="true">&larr;</span> Prev
        </button>

        <div className="pagination-pages" role="group" aria-label="Page selection">
          {pageNumbers.map((page, idx) =>
            page === '...' ? (
              <span key={`ellipsis-${idx}`} className="pagination-ellipsis" aria-hidden="true">
                &hellip;
              </span>
            ) : (
              <button
                key={page}
                type="button"
                className={`pagination-page-btn ${page === currentPage ? 'active' : ''}`}
                onClick={() => onPageChange(page)}
                aria-label={`Page ${page}`}
                aria-current={page === currentPage ? 'page' : undefined}
              >
                {page}
              </button>
            ),
          )}
        </div>

        <button
          type="button"
          className="pagination-btn pagination-next"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label="Go to next page"
        >
          Next <span aria-hidden="true">&rarr;</span>
        </button>
      </div>
    </nav>
  );
}

/**
 * Reusable hook to paginate any array in client memory.
 */
export function usePagination<T>(items: T[], pageSize = 10) {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalItems, totalPages, currentPage]);

  const pagedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, currentPage, pageSize]);

  return {
    currentPage,
    setCurrentPage,
    pageSize,
    totalItems,
    totalPages,
    pagedItems,
  };
}
