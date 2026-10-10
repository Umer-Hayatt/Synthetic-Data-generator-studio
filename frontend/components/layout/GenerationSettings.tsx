import React from 'react';
import { ConfigPanel } from '../configuration/ConfigPanel';
import styles from './Workspace.module.css';

export function GenerationSettings() {
  return <aside className={styles.insights} aria-label="Generation Settings">
    <h2 className={styles.settingsHeading}>Generation Settings</h2>
    <ConfigPanel embedded />
  </aside>;
}
