import React from 'react';
import Head from 'next/head';
import { useStudio } from '../context/StudioContext';
import { Header } from '../components/layout/Header';
import { EntryScreen } from '../components/ingestion/EntryScreen';
import { Workspace } from '../components/layout/Workspace';
import { SessionExpiredModal } from '../components/common/SessionExpiredModal';
import { NotificationToast } from '../components/common/NotificationToast';

export default function Home() {
  const { referenceToken, datasetSpec } = useStudio();

  return (
    <>
      <Head>
        <title>Data Mine</title>
        <meta
          name="description"
          content="General-purpose schema-aware synthetic structured data platform with statistical quality evaluation."
        />

        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className={`app-shell ${!referenceToken && !datasetSpec ? 'landing-shell' : 'studio-shell'}`} id="top">
        <a className="skip-link" href="#main-content">Skip to content</a>
          {!referenceToken && !datasetSpec ? (
            <div className="landing-scroll">
              <Header />
              <EntryScreen />
            </div>
          ) : (
            <Workspace />
          )}

        {/* Global Modals & Notifications */}
        <SessionExpiredModal />
        <NotificationToast />
      </div>
    </>
  );
}
