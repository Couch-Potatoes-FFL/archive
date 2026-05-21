import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDownUp } from "lucide-react";
import { useMemo, useState } from "react";

type SimpleTableProps<T> = {
  data: T[];
  columns: ColumnDef<T>[];
  search?: string;
  emptyLabel?: string;
};

export function SimpleTable<T>({
  data,
  columns,
  search = "",
  emptyLabel = "No rows found.",
}: SimpleTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const memoColumns = useMemo(() => columns, [columns]);

  const table = useReactTable({
    data,
    columns: memoColumns,
    state: {
      sorting,
      globalFilter: search,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
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
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="emptyCell">
                {emptyLabel}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
