import React, { useState } from 'react';
import styles from '../../styles/v2.module.css';

interface Props {
  disabled: boolean;
  onSubmit: (prompt: string) => void;
  aiUnavailable?: { reason: string; retryDelay?: number } | null;
}

const AI_REASON_LABELS: Record<string, string> = {
  missing_credential: 'No API key configured.',
  invalid_credential: 'API key was rejected (invalid or revoked).',
  rate_limit: 'Provider rate-limited; the system will retry automatically.',
  timeout: 'Request timed out.',
  provider_error: 'Provider returned a server error; retry shortly.',
  malformed_output: 'AI returned an unrecognisable response; try rephrasing.',
  unavailable: 'AI provider is temporarily unavailable.',
};

export function AIPromptPanel({ disabled, onSubmit, aiUnavailable }: Props) {
  const [prompt, setPrompt] = useState(
    'Create a Pakistani e-commerce company with customers, products, orders, payments and invoices.'
  );

  const canSubmit = !disabled && prompt.trim().length > 0;

  return (
    <div>
      <label htmlFor="v2-prompt" className={styles.muted} style={{ display: 'block', marginBottom: 6, color: 'var(--text-title)', fontWeight: 500 }}>
        Describe your dataset
      </label>
      <textarea
        id="v2-prompt"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={4}
        maxLength={12000}
        disabled={disabled}
        placeholder="e.g. A university with students, courses, enrolments and grade records..."
        style={{
          display: 'block',
          width: '100%',
          border: '1px solid var(--border-default)',
          borderRadius: 6,
          background: 'var(--bg-0)',
          color: 'var(--text-title)',
          padding: 9,
          resize: 'vertical',
          fontSize: 12,
        }}
      />
      <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>
        {prompt.length} / 12 000 characters
      </p>

      {aiUnavailable && (
        <div role="alert" style={{
          marginTop: 10, padding: '10px 12px',
          background: 'var(--amber-soft)', border: '1px solid var(--amber-border)',
          borderRadius: 6, fontSize: 12,
        }}>
          <strong>AI unavailable</strong> — {AI_REASON_LABELS[aiUnavailable.reason] ?? aiUnavailable.reason}
          {aiUnavailable.retryDelay && aiUnavailable.retryDelay > 0 && (
            <span> Retry after {Math.ceil(aiUnavailable.retryDelay)}s.</span>
          )}
          <span style={{ display: 'block', marginTop: 4, color: 'var(--text-muted)' }}>
            Upload a source file or load an example to continue without AI.
          </span>
        </div>
      )}

      <button
        disabled={!canSubmit}
        onClick={() => onSubmit(prompt.trim())}
        style={{ marginTop: 10 }}
      >
        Draft with AI
      </button>
    </div>
  );
}
