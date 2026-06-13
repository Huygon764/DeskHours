<script lang="ts">
  import {
    BackupError,
    applyBackupData,
    backupDownloadName,
    backupFileToJson,
    buildBackupFile,
    parseBackupJson,
    summarizeBackupData,
    type BackupSummary,
  } from '@/lib/backup';
  import { downloadBackupJson } from '@/lib/backup-download';
  import { syncBlockerSafe } from '@/lib/messages';
  import { t } from '@/lib/i18n';

  let fileInput = $state<HTMLInputElement | null>(null);
  let exportNotice = $state('');
  let exportError = $state('');
  let exportWaiting = $state(false);
  let importError = $state('');
  let importNotice = $state('');
  let importing = $state(false);
  let pendingSummary = $state<BackupSummary | null>(null);
  let pendingApply = $state<(() => Promise<void>) | null>(null);

  function clearMessages() {
    exportNotice = '';
    exportError = '';
    exportWaiting = false;
    importError = '';
    importNotice = '';
  }

  async function exportBackup() {
    clearMessages();
    pendingSummary = null;
    pendingApply = null;
    exportWaiting = true;
    try {
      const file = await buildBackupFile();
      const json = backupFileToJson(file);
      const filename = backupDownloadName(file.exportedAt);
      const result = await downloadBackupJson(json, filename);
      if (result === 'saved') {
        exportNotice = t('backupExportDone');
      }
    } catch (err) {
      console.error('export backup failed:', err);
      exportError = t('backupExportFailed');
    } finally {
      exportWaiting = false;
    }
  }

  function openImportPicker() {
    clearMessages();
    pendingSummary = null;
    pendingApply = null;
    fileInput?.click();
  }

  async function onFileSelected(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    clearMessages();
    pendingSummary = null;
    pendingApply = null;

    try {
      const text = await file.text();
      const parsed = parseBackupJson(text);
      pendingSummary = summarizeBackupData(parsed.data);
      pendingApply = async () => {
        importing = true;
        importError = '';
        importNotice = '';
        // Imported masked entries cannot be enforced until the user re-unlocks them,
        // since the password (and thus the AES key) is never part of a backup.
        const hadHidden = (pendingSummary?.hidden ?? 0) > 0;
        try {
          await applyBackupData(parsed.data);
          const synced = await syncBlockerSafe();
          pendingSummary = null;
          pendingApply = null;
          importNotice = synced ? t('backupImportDone') : t('backupImportDoneReload');
          if (hadHidden) importNotice += ` ${t('backupImportHiddenNote')}`;
        } catch (err) {
          console.error('import backup failed:', err);
          importError = t('backupImportFailed');
        } finally {
          importing = false;
        }
      };
    } catch (err) {
      console.error('parse backup failed:', err);
      importError = backupErrorMessage(err);
    }
  }

  function backupErrorMessage(err: unknown): string {
    if (err instanceof BackupError) {
      switch (err.code) {
        case 'invalid_json':
          return t('backupErrorInvalidJson');
        case 'unsupported_app':
          return t('backupErrorWrongApp');
        case 'newer_schema':
          return t('backupErrorNewerSchema');
        case 'masked_without_auth':
          return t('backupErrorMaskedNoAuth');
        default:
          return t('backupErrorInvalid');
      }
    }
    return t('backupErrorInvalid');
  }

  async function confirmImport() {
    if (!pendingApply || importing) return;
    await pendingApply();
  }

  function cancelImport() {
    pendingSummary = null;
    pendingApply = null;
    importError = '';
  }
</script>

<section class="card">
  <h2 class="text-headline-md section-title">{t('backupTitle')}</h2>
  <p class="text-body-muted intro">{t('backupIntro')}</p>
  <p class="sensitive-hint">{t('backupSensitiveHint')}</p>

  <div class="action-grid">
    <button type="button" class="action-tile" disabled={exportWaiting} onclick={() => void exportBackup()}>
      <span class="action-icon" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path
            d="M10 3v9m0 0 3.5-3.5M10 12 6.5 8.5M4 14v1.5A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5V14"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </span>
      <span class="action-label">{t('backupExport')}</span>
      <span class="action-hint">{t('backupExportHint')}</span>
    </button>

    <button type="button" class="action-tile" onclick={openImportPicker}>
      <span class="action-icon" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path
            d="M10 17V8m0 0 3.5 3.5M10 8 6.5 11.5M4 6V4.5A1.5 1.5 0 0 1 5.5 3h9A1.5 1.5 0 0 1 16 4.5V6"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </span>
      <span class="action-label">{t('backupImport')}</span>
      <span class="action-hint">{t('backupImportHint')}</span>
    </button>

    <input
      bind:this={fileInput}
      type="file"
      accept="application/json,.json"
      class="file-input"
      onchange={onFileSelected}
    />
  </div>

  {#if exportWaiting}
    <p class="export-waiting">{t('backupExportWaiting')}</p>
  {/if}
  {#if exportNotice}
    <p class="msg-success">{exportNotice}</p>
  {/if}
  {#if exportError}
    <p class="msg-error">{exportError}</p>
  {/if}

  {#if pendingSummary}
    <div class="preview">
      <p class="text-label preview-title">{t('backupPreviewTitle')}</p>
      <ul class="preview-list">
        <li>{t('backupPreviewSites', String(pendingSummary.sites))}</li>
        <li>{t('backupPreviewKeywords', String(pendingSummary.keywords))}</li>
        <li>{t('backupPreviewHidden', String(pendingSummary.hidden))}</li>
        <li>{t('backupPreviewSchedule', String(pendingSummary.scheduleWindows))}</li>
        <li>
          {pendingSummary.hasPassword ? t('backupPreviewPasswordYes') : t('backupPreviewPasswordNo')}
        </li>
      </ul>
      <p class="preview-warning">{t('backupImportWarning')}</p>
      <div class="preview-actions">
        <button
          type="button"
          class="btn btn-primary"
          disabled={importing}
          onclick={() => void confirmImport()}
        >
          {importing ? t('backupImporting') : t('backupImportConfirm')}
        </button>
        <button type="button" class="btn btn-outline" disabled={importing} onclick={cancelImport}>
          {t('cancel')}
        </button>
      </div>
    </div>
  {/if}

  {#if importNotice}<p class="msg-success">{importNotice}</p>{/if}
  {#if importError}<p class="msg-error">{importError}</p>{/if}
</section>

<style>
  .section-title {
    margin: 0 0 8px;
  }

  .intro {
    margin: 0 0 12px;
  }

  .sensitive-hint {
    margin: 0 0 20px;
    padding: 12px;
    border-radius: var(--radius-sm);
    background: var(--amber-bg);
    color: var(--amber-text);
    font-size: 13px;
    line-height: 1.4;
  }

  .action-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  @media (max-width: 520px) {
    .action-grid {
      grid-template-columns: 1fr;
    }
  }

  .action-tile {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    padding: 14px;
    border: 1px solid var(--border-variant);
    border-radius: var(--radius-sm);
    background: var(--surface-low);
    text-align: left;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }

  .action-tile:hover {
    border-color: var(--border);
    background: var(--surface);
  }

  .action-tile:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .action-tile:focus-visible {
    outline: none;
    border-color: var(--amber);
    box-shadow: 0 0 0 2px var(--amber-ring);
  }

  .action-icon {
    display: flex;
    color: var(--amber-text);
  }

  .action-label {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-strong);
  }

  .action-hint {
    font-size: 12px;
    line-height: 1.4;
    color: var(--text-muted);
  }

  .file-input {
    display: none;
  }

  .export-waiting {
    margin: 12px 0 0;
    font-size: 13px;
    color: var(--text-muted);
  }

  .preview {
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }

  .preview-title {
    margin: 0 0 8px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .preview-list {
    margin: 0 0 12px;
    padding-left: 20px;
    font-size: 14px;
    color: var(--text);
  }

  .preview-warning {
    margin: 0 0 12px;
    font-size: 13px;
    color: var(--text-muted);
  }

  .preview-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
</style>
