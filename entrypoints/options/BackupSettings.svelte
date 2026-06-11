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
  import { syncBlockerSafe } from '@/lib/messages';
  import { t } from '@/lib/i18n';

  let fileInput = $state<HTMLInputElement | null>(null);
  let exportNotice = $state('');
  let importError = $state('');
  let importNotice = $state('');
  let importing = $state(false);
  let pendingSummary = $state<BackupSummary | null>(null);
  let pendingApply = $state<(() => Promise<void>) | null>(null);

  function clearMessages() {
    exportNotice = '';
    importError = '';
    importNotice = '';
  }

  async function exportBackup() {
    clearMessages();
    pendingSummary = null;
    pendingApply = null;
    try {
      const file = await buildBackupFile();
      const json = backupFileToJson(file);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = backupDownloadName(file.exportedAt);
      anchor.click();
      URL.revokeObjectURL(url);
      exportNotice = t('backupExportDone');
    } catch (err) {
      console.error('export backup failed:', err);
      importError = t('backupExportFailed');
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
        try {
          await applyBackupData(parsed.data);
          const synced = await syncBlockerSafe();
          pendingSummary = null;
          pendingApply = null;
          importNotice = synced ? t('backupImportDone') : t('backupImportDoneReload');
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

<section class="card backup-card">
  <h2 class="text-headline-md section-title">{t('backupTitle')}</h2>
  <p class="text-body-muted intro">{t('backupIntro')}</p>
  <p class="sensitive-hint">{t('backupSensitiveHint')}</p>

  <div class="actions">
    <button type="button" class="btn btn-outline" onclick={() => void exportBackup()}>
      {t('backupExport')}
    </button>
    <button type="button" class="btn btn-primary" onclick={openImportPicker}>
      {t('backupImport')}
    </button>
    <input
      bind:this={fileInput}
      type="file"
      accept="application/json,.json"
      class="file-input"
      onchange={onFileSelected}
    />
  </div>

  {#if exportNotice}<p class="msg-success">{exportNotice}</p>{/if}

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

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .file-input {
    display: none;
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
