import React, { useState } from 'react';
import Head from 'next/head';
import { useStudio } from '../context/StudioContext';
import { Header } from '../components/layout/Header';
import { EntryScreen } from '../components/ingestion/EntryScreen';
import { Workspace } from '../components/layout/Workspace';
import { ExportModal } from '../components/export/ExportModal';
import { SessionExpiredModal } from '../components/common/SessionExpiredModal';
import { NotificationToast } from '../components/common/NotificationToast';

export default function Home() {
  const { referenceToken } = useStudio();
  const [isExportOpen, setIsExportOpen] = useState(false);

  return (
    <>
      <Head>
        <title>Synthetic Data Studio</title>
        <meta
          name="description"
          content="General-purpose schema-aware synthetic structured data platform with statistical quality evaluation and TSTR ML utility benchmarking."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="app-shell">
        <Header onOpenExport={() => setIsExportOpen(true)} />

        {/* Dynamic Display: Entry Screen if no active dataset; Studio Workspace once ingested */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {!referenceToken ? (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <EntryScreen />
            </div>
          ) : (
            <Workspace />
          )}
        </div>

        {/* Global Modals & Notifications */}
        <ExportModal
          isOpen={isExportOpen}
          onClose={() => setIsExportOpen(false)}
        />
        <SessionExpiredModal />
        <NotificationToast />
      </div>
    </>
  );
}
