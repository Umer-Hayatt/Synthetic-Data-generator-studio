import React from 'react';
import { useStudio } from '../../context/StudioContext';
import { SidebarNav } from './SidebarNav';
import { ConfigPanel } from '../configuration/ConfigPanel';
import { DataPreviewCanvas } from '../preview/DataPreviewCanvas';
import { SchemaInspector } from '../schema/SchemaInspector';
import { QualityDashboard } from '../quality/QualityDashboard';
import {
  Eye,
  Sliders,
  Activity,
  Database,
  CheckCircle2,
} from 'lucide-react';
import { WorkspaceTab } from '../../types';

export const Workspace: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    qualityResults,
    datasetName,
    generatedRowCount,
  } = useStudio();

  const tabs: {
    id: WorkspaceTab;
    label: string;
    icon: React.ReactNode;
    badge?: string;
  }[] = [
    {
      id: 'preview',
      label: 'Preview Data',
      icon: <Eye size={13} />,
    },
    {
      id: 'schema',
      label: 'Schema & Privacy',
      icon: <Sliders size={13} />,
    },
    {
      id: 'quality',
      label: 'Synthetic Quality',
      icon: <Activity size={13} />,
      badge:
        qualityResults?.overall_score !== null &&
        qualityResults?.overall_score !== undefined
          ? `${Math.round(qualityResults.overall_score)}%`
          : undefined,
    },
  ];


  return (
    <div className="workspace-layout">
      {/* Column 1: Left Sidebar (240px) */}
      <SidebarNav />

      {/* Column 2: Center Canvas (Flexible / Largest region) */}
      <main className="center-canvas">
        {/* Canvas Header: Name, Status, and Tab Navigation */}
        <div className="canvas-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              {datasetName || 'customer_churn'}
            </span>
            <span className="badge badge-synth" style={{ fontSize: '9px' }}>
              {generatedRowCount > 0 ? `Synthesized (${generatedRowCount} rows)` : 'Not generated'}
            </span>
          </div>

          <nav className="tab-nav">
            {tabs.map((tab) => {
              const isSelected = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`tab-btn ${isSelected ? 'active' : ''}`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span
                      className={`badge ${isSelected ? 'badge-blue' : 'badge-slate'}`}
                      style={{ fontSize: '9px', padding: '1px 5px' }}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Canvas Body: Active Tab Content */}
        <div className="canvas-body">
          {activeTab === 'preview' && <DataPreviewCanvas />}
          {activeTab === 'schema' && <SchemaInspector />}
          {activeTab === 'quality' && <QualityDashboard />}
        </div>

      </main>

      {/* Column 3: Right Sidebar (300px) */}
      <ConfigPanel />
    </div>
  );
};
