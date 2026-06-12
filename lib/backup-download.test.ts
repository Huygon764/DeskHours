import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { downloadBackupJson } from './backup-download';

describe('downloadBackupJson', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:backup');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(browser.downloads, 'download').mockImplementation(async () => 1);
  });

  it('resolves saved when the download completes', async () => {
    vi.spyOn(browser.downloads, 'search')
      .mockImplementationOnce(async () => [{ state: 'in_progress' } as Browser.downloads.DownloadItem])
      .mockImplementationOnce(async () => [{ state: 'complete' } as Browser.downloads.DownloadItem]);

    vi.useFakeTimers();
    const pending = downloadBackupJson('{"ok":true}', 'deskhours-backup.json');
    await vi.advanceTimersByTimeAsync(200);
    await expect(pending).resolves.toBe('saved');
    vi.useRealTimers();
  });

  it('resolves cancelled when the download item disappears', async () => {
    vi.spyOn(browser.downloads, 'search').mockImplementation(async () => []);

    await expect(downloadBackupJson('{"ok":true}', 'deskhours-backup.json')).resolves.toBe(
      'cancelled',
    );
  });

  it('resolves cancelled when the download is interrupted', async () => {
    vi.spyOn(browser.downloads, 'search').mockImplementation(async () => [
      { state: 'interrupted' } as Browser.downloads.DownloadItem,
    ]);

    await expect(downloadBackupJson('{"ok":true}', 'deskhours-backup.json')).resolves.toBe(
      'cancelled',
    );
  });

  it('resolves cancelled when download() returns no id', async () => {
    vi.spyOn(browser.downloads, 'download').mockImplementation(async () => undefined as unknown as number);

    await expect(downloadBackupJson('{"ok":true}', 'deskhours-backup.json')).resolves.toBe(
      'cancelled',
    );
  });
});
