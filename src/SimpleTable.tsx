import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  PaginationState,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDownUp, ChevronLeft, ChevronRight } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";

type SimpleTableProps<T> = {
  data: T[];
  columns: ColumnDef<T>[];
  search?: string;
  emptyLabel?: string;
  mobileCard?: (row: T) => ReactNode;
  mobileLabel?: string;
};

export function SimpleTable<T>({
  data,
  columns,
  search = "",
  emptyLabel = "No rows found.",
  mobileCard,
  mobileLabel = "Mobile table rows",
}: SimpleTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 50,
  });
  const memoColumns = useMemo(() => columns, [columns]);

  useEffect(() => {
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  }, [data, search]);

  const table = useReactTable({
    data,
    columns: memoColumns,
    state: {
      sorting,
      pagination,
      globalFilter: search,
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const filteredCount = table.getFilteredRowModel().rows.length;
  const pageRows = table.getRowModel().rows;
  const firstRow = filteredCount === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1;
  const lastRow = Math.min(
    filteredCount,
    pagination.pageIndex * pagination.pageSize + pageRows.length,
  );

  return (
    <div className="simpleTable">
      <div className="tableWrap">
        <table>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id}>
                    {header.isPlaceholder ? null : (
                      <button
                        className="thButton"
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        title="Sort column"
                      >
                        <span>
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                        </span>
                        <ArrowDownUp size={14} aria-hidden />
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="emptyCell">
                  {emptyLabel}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="mobileTableList" aria-label={mobileLabel}>
        {pageRows.length ? (
          pageRows.map((row) => (
            <div className="mobileTableItem" key={row.id}>
              {mobileCard ? (
                mobileCard(row.original)
              ) : (
                <div className="mobileDataCard generic">
                  {row.getVisibleCells().map((cell) => (
                    <div className="mobileField" key={cell.id}>
                      <span>{mobileHeaderLabel(cell.column.columnDef.header)}</span>
                      <strong>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        ) : (
          <p className="emptyNote">{emptyLabel}</p>
        )}
      </div>
      <div className="tablePager" aria-label="Table pagination">
        <span>
          Showing {firstRow}-{lastRow} of {filteredCount.toLocaleString()} rows
        </span>
        <div className="pagerActions">
          <button
            type="button"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            title="Previous page"
          >
            <ChevronLeft size={16} aria-hidden />
            Previous
          </button>
          <button
            type="button"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            title="Next page"
          >
            Next
            <ChevronRight size={16} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

function mobileHeaderLabel<T>(header: ColumnDef<T>["header"]): string {
  return typeof header === "string" ? header : "Value";
}
