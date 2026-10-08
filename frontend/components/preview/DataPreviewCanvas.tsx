import React, { useState } from 'react';
import { useStudio } from '../../context/StudioContext';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Database,
  Sparkles,
  Sliders,
} from 'lucide-react';

export const DataPreviewCanvas: React.FC = () => {
  const {
    previewViewMode,
    setPreviewViewMode,
    generatedPreview,
    generatedRowCount,
    generatedColumns,
    referencePreview,
    referenceRowCount,
    referenceColumns,
    datasetSpec,
    setActiveTab,
  } = useStudio();

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 12;

  const isSynthetic = previewViewMode === 'generated';
  const rawRows = isSynthetic ? generatedPreview : referencePreview;
  const columns = isSynthetic
    ? generatedColumns.length
      ? generatedColumns
      : datasetSpec?.tables[0]?.columns.map((c) => c.name) || []
    : referenceColumns;
  const totalCount = isSynthetic ? generatedRowCount : referenceRowCount;

  // Filter rows
  const filteredRows = rawRows.filter((row) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return Object.values(row).some((val) =>
      String(val ?? '').toLowerCase().includes(term)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const displayedRows = filteredRows.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize
  );

  return (
    <div className="grid-container">
      {/* Toolbar: Switcher + Search + Pagination */}
      <div className="grid-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--surface-muted)', padding: '3px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
          <button
            onClick={() => {
              setPreviewViewMode('generated');
              setCurrentPage(0);
            }}
            className={`btn btn-sm ${isSynthetic ? 'btn-synth' : 'btn-ghost'}`}
            style={{ borderRadius: 'var(--radius-xs)', fontSize: '11px', padding: '4px 10px' }}
          >
            <Sparkles size={12} />
            <span>Synthetic Preview</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', opacity: 0.85, marginLeft: '4px' }}>
              ({generatedRowCount})
            </span>
          </button>

          <button
            onClick={() => {
              setPreviewViewMode('reference');
              setCurrentPage(0);
            }}
            className={`btn btn-sm ${!isSynthetic ? 'btn-secondary' : 'btn-ghost'}`}
            style={{ borderRadius: 'var(--radius-xs)', fontSize: '11px', padding: '4px 10px' }}
          >
            <Database size={12} />
            <span>Real Reference Sample</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', opacity: 0.85, marginLeft: '4px' }}>
              ({referenceRowCount})
            </span>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={12} style={{ position: 'absolute', left: '8px', top: '8px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Filter preview rows..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(0);
              }}
              className="input-text"
              style={{ paddingLeft: '26px', width: '180px', height: '28px' }}
            />
          </div>

          <button
            onClick={() => setActiveTab('schema')}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '11px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '5px' }}
            title="Edit schema columns, constraints, and distributions"
          >
            <Sliders size={12} />
            <span>Edit schema</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>
              {currentPage + 1}/{totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="btn btn-ghost btn-sm"
              style={{ padding: '3px 5px' }}
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage >= totalPages - 1}
              className="btn btn-ghost btn-sm"
              style={{ padding: '3px 5px' }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Data Table */}
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>#</th>
              {columns.map((colName) => (
                <th key={colName}>{colName}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayedRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  No matching records in preview cache.
                </td>
              </tr>
            ) : (
              displayedRows.map((row, rIdx) => {
                const globalIdx = currentPage * pageSize + rIdx + 1;
                return (
                  <tr key={rIdx}>
                    <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '10px' }}>
                      {globalIdx}
                    </td>
                    {columns.map((colName) => {
                      const val = row[colName];
                      const isNull = val === null || val === undefined;
                      const isNumeric = typeof val === 'number';

                      return (
                        <td
                          key={colName}
                          className={`${isNumeric ? 'cell-num' : ''} ${isNull ? 'cell-null' : ''}`}
                        >
                          {isNull ? (
                            'null'
                          ) : typeof val === 'boolean' ? (
                            <span className={`badge ${val ? 'badge-synth' : 'badge-slate'}`} style={{ fontSize: '9px' }}>
                              {String(val)}
                            </span>
                          ) : isNumeric ? (
                            val.toLocaleString(undefined, { maximumFractionDigits: 2 })
                          ) : (
                            String(val)
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
        <span>
          Showing preview of {rawRows.length} cached rows ({totalCount.toLocaleString()} total in {isSynthetic ? 'synthetic output' : 'reference dataset'}).
        </span>
        <span>
          Full table downloads available via Export.
        </span>
      </div>
    </div>
  );
};
