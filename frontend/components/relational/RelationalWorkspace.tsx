import React, { useState, useEffect } from 'react';
import { useStudio } from '../../context/StudioContext';
import { api } from '../../services/api';
import {
  Network,
  Table2,
  Key,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Loader2,
  Download,
  ChevronLeft,
  ChevronRight,
  Database,
  ArrowRight,
} from 'lucide-react';

export const RelationalWorkspace: React.FC = () => {
  const {
    datasetSpec,
    updateSpec,
    tableArtifactMap,
    isGenerating,
    generateRelationalFromSpec,
    relationalPreviews,
  } = useStudio();

  const tables = datasetSpec?.tables || [];
  const [activeTableName, setActiveTableName] = useState<string>(tables[0]?.name || '');
  const [previewPage, setPreviewPage] = useState(0);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [tableRows, setTableRows] = useState<Record<string, Record<string, unknown>[]>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync active table if tables change
  useEffect(() => {
    if (tables.length > 0 && (!activeTableName || !tables.some((t) => t.name === activeTableName))) {
      setActiveTableName(tables[0].name);
      setPreviewPage(0);
    }
  }, [tables, activeTableName]);

  // Active Table
  const currentTable = tables.find((t) => t.name === activeTableName) || tables[0];
  const currentArtifactId = currentTable ? tableArtifactMap[currentTable.name] : undefined;

  // Fetch or resolve preview rows for active table
  useEffect(() => {
    if (!currentTable) return;
    let cancelled = false;

    // Check if we already have preview in context or state
    if (relationalPreviews[currentTable.name]) {
      setTableRows((prev) => ({ ...prev, [currentTable.name]: relationalPreviews[currentTable.name] }));
      return;
    }

    if (currentArtifactId) {
      setLoadingPreview(true);
      api
        .getArtifact(currentArtifactId, 50)
        .then((art) => {
          if (cancelled) return;
          setTableRows((prev) => ({ ...prev, [currentTable.name]: (art.preview as any) || [] }));
        })
        .catch(() => {
          // non-fatal
        })
        .finally(() => {
          if (!cancelled) setLoadingPreview(false);
        });
    }
    return () => { cancelled = true; };
  }, [currentTable?.name, currentArtifactId, relationalPreviews]);

  // Collect all relationships
  const allRelationships = tables.flatMap((t) =>
    (t.foreign_keys || []).map((fk) => ({
      childTable: t.name,
      childCol: fk.column,
      parentTable: fk.reference_table,
      parentCol: fk.reference_column,
      cardinality: fk.cardinality || '1:N',
      minChildren: fk.min_children ?? 0,
    }))
  );

  // Candidate FK targets (other tables)
  const candidateFkTargets = tables
    .filter((t) => t.name !== currentTable?.name)
    .flatMap((t) => {
      const cols = t.primary_key ? [t.primary_key] : t.columns.map((c) => c.name);
      return cols.map((c) => ({ table: t.name, column: c, label: `${t.name}.${c}` }));
    });

  // Handle adding or changing a foreign key
  const handleFkChange = (childCol: string, targetValue: string) => {
    if (!datasetSpec || !currentTable) return;
    const currentFks = currentTable.foreign_keys ? [...currentTable.foreign_keys] : [];
    const filteredFks = currentFks.filter((fk) => fk.column !== childCol);

    if (targetValue) {
      const [refTable, refCol] = targetValue.split('.');
      if (refTable && refCol) {
        filteredFks.push({
          column: childCol,
          reference_table: refTable,
          reference_column: refCol,
          cardinality: '1:N',
          min_children: 1,
        });
      }
    }

    const updatedTables = tables.map((t) =>
      t.name === currentTable.name ? { ...t, foreign_keys: filteredFks } : t
    );
    updateSpec({ ...datasetSpec, tables: updatedTables });
  };

  // Handle cardinality toggle
  const handleToggleCardinality = (childCol: string, newCardinality: string) => {
    if (!datasetSpec || !currentTable) return;
    const currentFks = (currentTable.foreign_keys || []).map((fk) =>
      fk.column === childCol ? { ...fk, cardinality: newCardinality } : fk
    );
    const updatedTables = tables.map((t) =>
      t.name === currentTable.name ? { ...t, foreign_keys: currentFks } : t
    );
    updateSpec({ ...datasetSpec, tables: updatedTables });
  };

  // Generate relational data
  const handleGenerate = async () => {
    setErrorMsg(null);
    try {
      await generateRelationalFromSpec();
    } catch (err: any) {
      setErrorMsg(err.message || 'Relational generation failed.');
    }
  };

  // Preview Pagination
  const rows = (currentTable ? tableRows[currentTable.name] : []) || [];
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pagedRows = rows.slice(previewPage * pageSize, (previewPage + 1) * pageSize);

  // Fallback direct table CSV download
  const handleDownloadTableCsv = () => {
    if (!currentTable || !rows.length) return;
    const cols = currentTable.columns.map((c) => c.name);
    const csvContent = [
      cols.join(','),
      ...rows.map((r) => cols.map((c) => JSON.stringify(r[c] ?? '')).join(',')),
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentTable.name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasAnyGenerated = Object.keys(tableArtifactMap).length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '32px' }}>
      {/* 1. Header Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          background: 'var(--surface)',
          padding: '16px 20px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              background: 'var(--surface-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-primary)',
            }}
          >
            <Network size={18} />
          </div>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Relational Schema & Synthesis
            </h2>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
              Multi-table schema inference with strict primary/foreign key consistency and zero orphan records.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={handleGenerate}
            disabled={isGenerating || tables.length < 2}
            className="btn btn-synth btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            {isGenerating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            <span>Generate Relational Data</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div
          style={{
            padding: '12px 16px',
            background: 'var(--error-bg)',
            border: '1px solid var(--error-border)',
            borderRadius: 'var(--radius-xs)',
            color: 'var(--error)',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 2. Table Switcher */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
            Tables in Scope ({tables.length})
          </span>
          {tables.length <= 1 && (
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              No multi-table relationships are configured for the current dataset.
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {tables.map((t) => {
            const isSelected = t.name === activeTableName;
            const hasData = !!tableArtifactMap[t.name] || (tableRows[t.name]?.length ?? 0) > 0;
            return (
              <button
                key={t.name}
                onClick={() => {
                  setActiveTableName(t.name);
                  setPreviewPage(0);
                }}
                disabled={isGenerating}
                style={{
                  padding: '7px 14px',
                  borderRadius: '20px',
                  border: `1px solid ${isSelected ? 'var(--text-primary)' : 'var(--border-subtle)'}`,
                  background: isSelected ? 'var(--primary-btn-bg)' : 'var(--surface)',
                  color: isSelected ? '#ffffff' : 'var(--text-body)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: isSelected ? 600 : 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>{t.name}</span>
                <span
                  style={{
                    fontSize: '10px',
                    padding: '1px 6px',
                    borderRadius: '10px',
                    background: isSelected ? 'rgba(255,255,255,0.2)' : 'var(--surface-muted)',
                    color: isSelected ? '#ffffff' : 'var(--text-muted)',
                    fontWeight: 500,
                  }}
                >
                  {t.row_count.toLocaleString()} rows
                </span>
                {hasData && (
                  <span style={{ fontSize: '11px', color: isSelected ? '#ffffff' : 'var(--success)' }}>
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Relationship Map & Integrity Badges */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          padding: '18px 20px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Relationship Map & Referential Invariants
            </h3>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              Foreign key constraints and topological DAG execution order
            </p>
          </div>

          {/* Integrity Badges */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: 'var(--radius-xs)',
                fontSize: '11px',
                fontWeight: 500,
                background: 'var(--success-bg)',
                border: '1px solid var(--success-border)',
                color: 'var(--success)',
              }}
            >
              <CheckCircle2 size={12} />
              <span>{hasAnyGenerated ? 'Foreign keys validated at generation' : 'Foreign keys: not generated'}</span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: 'var(--radius-xs)',
                fontSize: '11px',
                fontWeight: 500,
                background: 'var(--success-bg)',
                border: '1px solid var(--success-border)',
                color: 'var(--success)',
              }}
            >
              <Key size={12} />
              <span>{hasAnyGenerated ? 'Primary keys validated at generation' : 'Primary keys: not generated'}</span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: 'var(--radius-xs)',
                fontSize: '11px',
                fontWeight: 500,
                background: 'var(--success-bg)',
                border: '1px solid var(--success-border)',
                color: 'var(--success)',
              }}
            >
              <ShieldCheck size={12} />
              <span>{hasAnyGenerated ? 'DAG validated at generation' : 'DAG: not generated'}</span>
            </div>
          </div>
        </div>

        {/* Foreign Key Connections List */}
        {allRelationships.length === 0 ? (
          <div
            style={{
              padding: '16px',
              background: 'var(--surface-muted)',
              borderRadius: 'var(--radius-xs)',
              fontSize: '12px',
              color: 'var(--text-muted)',
              textAlign: 'center',
            }}
          >
            No foreign key relationships are configured for this dataset.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {allRelationships.map((rel, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: 'var(--surface-muted)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-xs)',
                  fontSize: '12px',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-mono)' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {rel.childTable}.{rel.childCol}
                  </span>
                  <ArrowRight size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {rel.parentTable}.{rel.parentCol}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="badge badge-slate" style={{ fontSize: '10px' }}>
                    Cardinality: {rel.cardinality}
                  </span>
                  <span className="badge badge-synth" style={{ fontSize: '10px' }}>
                    {hasAnyGenerated ? 'Validated at generation' : 'Configured constraint'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Active Table Schema & Foreign Key Configuration */}
      {currentTable && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: '18px 20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Table2 size={16} style={{ color: 'var(--text-primary)' }} />
              <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                {currentTable.name} Schema ({currentTable.columns.length} columns)
              </h3>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Primary Key: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{currentTable.primary_key || 'id'}</strong>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-medium)', textAlign: 'left' }}>
                <th style={{ padding: '8px 10px', color: 'var(--text-muted)', fontWeight: 600 }}>Column</th>
                <th style={{ padding: '8px 10px', color: 'var(--text-muted)', fontWeight: 600 }}>Type</th>
                <th style={{ padding: '8px 10px', color: 'var(--text-muted)', fontWeight: 600 }}>Semantic</th>
                <th style={{ padding: '8px 10px', color: 'var(--text-muted)', fontWeight: 600 }}>Foreign Key Reference</th>
              </tr>
            </thead>
            <tbody>
              {currentTable.columns.map((col) => {
                const isPk = col.name === currentTable.primary_key;
                const fk = currentTable.foreign_keys?.find((f) => f.column === col.name);
                const currentVal = fk ? `${fk.reference_table}.${fk.reference_column}` : '';

                return (
                  <tr key={col.name} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {isPk && (
                          <span title="Primary Key">
                            <Key size={12} style={{ color: 'var(--text-muted)' }} />
                          </span>
                        )}
                        <span>{col.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '8px 10px', color: 'var(--text-muted)', fontSize: '11px' }}>
                      {col.dtype}
                    </td>
                    <td style={{ padding: '8px 10px', color: 'var(--text-muted)', fontSize: '11px' }}>
                      {col.semantic_type}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      {isPk ? (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>— (Primary Key)</span>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <select
                            value={currentVal}
                            onChange={(e) => handleFkChange(col.name, e.target.value)}
                            disabled={isGenerating}
                            style={{
                              padding: '4px 8px',
                              borderRadius: 'var(--radius-xs)',
                              border: '1px solid var(--border-subtle)',
                              background: 'var(--surface)',
                              fontSize: '11px',
                              color: 'var(--text-primary)',
                              fontFamily: 'var(--font-mono)',
                            }}
                          >
                            <option value="">None (Independent)</option>
                            {candidateFkTargets.map((target) => (
                              <option key={target.label} value={target.label}>
                                → {target.label}
                              </option>
                            ))}
                          </select>

                          {fk && (
                            <button
                              onClick={() => handleToggleCardinality(col.name, fk.cardinality === '1:1' ? '1:N' : '1:1')}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '2px 6px', fontSize: '10px' }}
                              title="Toggle Cardinality between 1:N and 1:1"
                            >
                              {fk.cardinality || '1:N'}
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 5. Generated Data Preview Canvas for Active Table */}
      {currentTable && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: '18px 20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={16} style={{ color: 'var(--text-primary)' }} />
              <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                {currentTable.name} Generated Records ({rows.length > 0 ? rows.length : currentTable.row_count} rows)
              </h3>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {rows.length > 0 && (
                <button
                  onClick={handleDownloadTableCsv}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Download size={13} />
                  <span>Download Table CSV</span>
                </button>
              )}

              {/* Pagination controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  onClick={() => setPreviewPage((p) => Math.max(0, p - 1))}
                  disabled={previewPage === 0}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '4px 6px' }}
                >
                  <ChevronLeft size={13} />
                </button>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '0 4px' }}>
                  {previewPage + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPreviewPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={previewPage >= totalPages - 1}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '4px 6px' }}
                >
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          </div>

          {loadingPreview ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Loader2 size={20} className="animate-spin" style={{ margin: '0 auto 8px' }} />
              <div style={{ fontSize: '12px' }}>Loading table preview...</div>
            </div>
          ) : rows.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
              No rows generated yet for table &quot;{currentTable.name}&quot;. Click &quot;Generate Relational Data&quot; to synthesize all tables with full referential integrity.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-medium)', textAlign: 'left', background: 'var(--surface-muted)' }}>
                    {currentTable.columns.map((c) => (
                      <th key={c.name} style={{ padding: '8px 10px', color: 'var(--text-muted)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                        {c.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.map((row, rIdx) => (
                    <tr key={rIdx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      {currentTable.columns.map((c) => (
                        <td key={c.name} style={{ padding: '8px 10px', color: 'var(--text-body)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                          {row[c.name] !== undefined && row[c.name] !== null ? String(row[c.name]) : '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
