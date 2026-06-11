import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  BACKUP_SCHEMA_VERSION,
  BackupError,
  applyBackupData,
  buildBackupFile,
  parseBackupJson,
  summarizeBackupData,
  validateBackupData,
} from './backup';
import { blocklistItem, scheduleItem, authItem } from './storage';
import { DEFAULT_SCHEDULE } from './schedule';

const SAMPLE_DATA = {
  blocklist: [{ id: '1', domain: 'facebook.com', masked: false, enabled: true, kind: 'site' as const }],
  schedule: DEFAULT_SCHEDULE,
  auth: null,
  unblockMinutes: 5,
  theme: 'system' as const,
  locale: 'en' as const,
  pomodoro: { workMinutes: 25, restMinutes: 5 },
  timer: { durationSeconds: 300, soundEnabled: true },
};

describe('backup parse/validate', () => {
  it('parses a valid backup file', () => {
    const json = JSON.stringify({
      schemaVersion: BACKUP_SCHEMA_VERSION,
      app: 'site-blocker',
      exportedAt: '2026-06-07T12:00:00.000Z',
      data: SAMPLE_DATA,
    });
    const file = parseBackupJson(json);
    expect(file.data.blocklist).toHaveLength(1);
    expect(summarizeBackupData(file.data).sites).toBe(1);
  });

  it('rejects invalid JSON', () => {
    expect(() => parseBackupJson('not json')).toThrow(BackupError);
  });

  it('rejects wrong app id', () => {
    const json = JSON.stringify({
      schemaVersion: 1,
      app: 'other-app',
      exportedAt: '2026-06-07T12:00:00.000Z',
      data: SAMPLE_DATA,
    });
    expect(() => parseBackupJson(json)).toThrow(/site-blocker/);
  });

  it('rejects newer schema version', () => {
    const json = JSON.stringify({
      schemaVersion: BACKUP_SCHEMA_VERSION + 1,
      app: 'site-blocker',
      exportedAt: '2026-06-07T12:00:00.000Z',
      data: SAMPLE_DATA,
    });
    expect(() => parseBackupJson(json)).toThrow(BackupError);
  });

  it('rejects masked entries without auth', () => {
    expect(() =>
      validateBackupData({
        ...SAMPLE_DATA,
        blocklist: [{ id: '1', domain: 'cipher', masked: true }],
      }),
    ).toThrow(BackupError);
  });
});

describe('backup export/import', () => {
  beforeEach(() => fakeBrowser.reset());

  it('round-trips through build and apply', async () => {
    await blocklistItem.setValue([{ id: 'a', domain: 'x.com', masked: false }]);
    await scheduleItem.setValue(DEFAULT_SCHEDULE);

    const exported = await buildBackupFile();
    await blocklistItem.setValue([]);
    await applyBackupData(exported.data);

    expect(await blocklistItem.getValue()).toEqual(exported.data.blocklist);
    expect(await scheduleItem.getValue()).toEqual(exported.data.schedule);
  });

  it('restores auth record', async () => {
    const auth = { hash: 'h', salt: 's', iterations: 600_000 };
    await authItem.setValue(auth);
    const exported = await buildBackupFile();
    await authItem.setValue(null);
    await applyBackupData(exported.data);
    expect(await authItem.getValue()).toEqual(auth);
  });
});
