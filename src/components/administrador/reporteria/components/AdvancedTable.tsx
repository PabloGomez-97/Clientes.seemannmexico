// src/components/common/AdvancedTable.tsx
import React, { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
} from '@tanstack/react-table';
import { 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Download, 
  Settings2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Maximize2,
  Minimize2
} from 'lucide-react';

interface AdvancedTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  onRowClick?: (row: T) => void;
  exportFileName?: string;
}

type Density = 'comfortable' | 'compact' | 'dense';

export function AdvancedTable<T>({ data, columns, onRowClick, exportFileName = 'export' }: AdvancedTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [density, setDensity] = useState<Density>('comfortable');
  const [showColumnSettings, setShowColumnSettings] = useState(false);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  const densityPadding = {
    comfortable: 'py-3',
    compact: 'py-2',
    dense: 'py-1',
  };

  const exportToCSV = () => {
    const filteredRows = table.getFilteredRowModel().rows;
    const visibleColumns = table.getVisibleLeafColumns();
    
    // Headers
    const headers = visibleColumns.map(col => col.columnDef.header as string).join(',');
    
    // Rows
    const csvRows = filteredRows.map(row => {
      return visibleColumns.map(col => {
        const value = row.getValue(col.id);
        // Escape commas and quotes
        const stringValue = String(value || '').replace(/"/g, '""');
        return `"${stringValue}"`;
      }).join(',');
    });
    
    const csv = [headers, ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportFileName}.csv`;
    a.click();
  };

  if (data.length === 0) {
    return (
      <div 
        className="card border-0"
        style={{ 
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
        }}
      >
        <div className="card-body text-center py-5">
          <p className="text-muted mb-0">No hay datos disponibles</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="d-flex gap-2">
          {/* Density Toggle */}
          <div className="btn-group" role="group">
          </div>
        </div>

        <div className="d-flex gap-2">
          {/* Column Visibility */}
          <div className="position-relative">
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setShowColumnSettings(!showColumnSettings)}
              style={{
                fontSize: '0.8rem',
                padding: '6px 12px',
                border: '1px solid #e5e7eb',
                backgroundColor: 'white',
                color: '#6b7280'
              }}
            >
              <Settings2 size={14} className="me-1" />
              Columnas
            </button>
            {showColumnSettings && (
              <div 
                className="position-absolute end-0 mt-1 bg-white border rounded shadow-sm p-3"
                style={{ 
                  zIndex: 10, 
                  minWidth: '200px',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}
              >
                <div className="mb-2 pb-2" style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <small className="text-muted" style={{ fontSize: '0.75rem' }}>
                    Mostrar/Ocultar Columnas
                  </small>
                </div>
                {table.getAllLeafColumns().map(column => (
                  <div key={column.id} className="form-check mb-2">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id={`column-${column.id}`}
                      checked={column.getIsVisible()}
                      onChange={column.getToggleVisibilityHandler()}
                      style={{ cursor: 'pointer' }}
                    />
                    <label 
                      className="form-check-label" 
                      htmlFor={`column-${column.id}`}
                      style={{ fontSize: '0.85rem', cursor: 'pointer', color: '#1f2937' }}
                    >
                      {column.columnDef.header as string}
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Export CSV */}
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={exportToCSV}
            style={{
              fontSize: '0.8rem',
              padding: '6px 12px',
              border: '1px solid #e5e7eb',
              backgroundColor: 'white',
              color: '#6b7280'
            }}
          >
            <Download size={14} className="me-1" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div 
        className="card border-0"
        style={{ 
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
        }}
      >
        <div className="table-responsive" style={{ maxHeight: '600px', overflowY: 'auto' }}>
          <table className="table mb-0" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead style={{ position: 'sticky', top: 0, backgroundColor: '#fafafa', zIndex: 5 }}>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th
                      key={header.id}
                      className="border-0"
                      style={{
                        padding: '12px 16px',
                        color: '#6b7280',
                        fontWeight: 500,
                        fontSize: '0.8rem',
                        borderBottom: '1px solid #e5e7eb',
                        cursor: header.column.getCanSort() ? 'pointer' : 'default',
                        userSelect: 'none'
                      }}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="d-flex align-items-center justify-content-between">
                        <span>
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </span>
                        {header.column.getCanSort() && (
                          <span className="ms-2">
                            {header.column.getIsSorted() === 'asc' ? (
                              <ArrowUp size={14} />
                            ) : header.column.getIsSorted() === 'desc' ? (
                              <ArrowDown size={14} />
                            ) : (
                              <ArrowUpDown size={14} style={{ opacity: 0.3 }} />
                            )}
                          </span>
                        )}
                      </div>
                      {header.column.getCanFilter() && (
                        <div className="mt-2">
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="Filtrar..."
                            value={(header.column.getFilterValue() ?? '') as string}
                            onChange={e => header.column.setFilterValue(e.target.value)}
                            onClick={e => e.stopPropagation()}
                            style={{
                              fontSize: '0.75rem',
                              padding: '4px 8px',
                              border: '1px solid #e5e7eb',
                              borderRadius: '4px'
                            }}
                          />
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row, index) => (
                <tr
                  key={row.id}
                  style={{
                    borderBottom: index < table.getRowModel().rows.length - 1 ? '1px solid #f3f4f6' : 'none',
                    cursor: onRowClick ? 'pointer' : 'default',
                    transition: 'background-color 0.15s'
                  }}
                  onClick={() => onRowClick?.(row.original)}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  {row.getVisibleCells().map(cell => (
                    <td
                      key={cell.id}
                      className={`border-0 ${densityPadding[density]}`}
                      style={{
                        padding: density === 'comfortable' ? '12px 16px' : density === 'compact' ? '8px 16px' : '6px 16px',
                        fontSize: '0.9rem',
                        color: '#1f2937'
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="d-flex justify-content-between align-items-center mt-3">
        <div className="d-flex align-items-center gap-2">
          <span className="text-muted" style={{ fontSize: '0.85rem' }}>
            Filas por página:
          </span>
          <select
            className="form-select form-select-sm"
            value={table.getState().pagination.pageSize}
            onChange={e => table.setPageSize(Number(e.target.value))}
            style={{
              width: 'auto',
              fontSize: '0.85rem',
              border: '1px solid #e5e7eb',
              padding: '4px 8px'
            }}
          >
            {[5, 10, 20, 50, 100].map(pageSize => (
              <option key={pageSize} value={pageSize}>
                {pageSize}
              </option>
            ))}
          </select>
          <span className="text-muted ms-3" style={{ fontSize: '0.85rem' }}>
            Mostrando {table.getRowModel().rows.length} de {table.getFilteredRowModel().rows.length} resultados
          </span>
        </div>

        <div className="d-flex gap-1">
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            style={{
              fontSize: '0.8rem',
              padding: '6px 10px',
              border: '1px solid #e5e7eb'
            }}
          >
            <ChevronsLeft size={16} />
          </button>
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            style={{
              fontSize: '0.8rem',
              padding: '6px 10px',
              border: '1px solid #e5e7eb'
            }}
          >
            <ChevronLeft size={16} />
          </button>
          <span 
            className="btn btn-sm disabled"
            style={{
              fontSize: '0.85rem',
              padding: '6px 12px',
              color: '#1f2937'
            }}
          >
            Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
          </span>
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            style={{
              fontSize: '0.8rem',
              padding: '6px 10px',
              border: '1px solid #e5e7eb'
            }}
          >
            <ChevronRight size={16} />
          </button>
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
            style={{
              fontSize: '0.8rem',
              padding: '6px 10px',
              border: '1px solid #e5e7eb'
            }}
          >
            <ChevronsRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}