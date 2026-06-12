const POLL_MS = 200;
const DOWNLOAD_WAIT_MS = 10 * 60 * 1000;

async function waitForDownloadEnd(downloadId: number): Promise<'saved' | 'cancelled'> {
  const deadline = Date.now() + DOWNLOAD_WAIT_MS;

  while (Date.now() < deadline) {
    const [item] = await browser.downloads.search({ id: downloadId });

    if (!item) return 'cancelled';
    if (item.state === 'complete') return 'saved';
    if (item.state === 'interrupted') return 'cancelled';

    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }

  return 'cancelled';
}

/** Prompt for a save location and report whether the user saved or cancelled. */
export async function downloadBackupJson(
  json: string,
  filename: string,
): Promise<'saved' | 'cancelled'> {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));

  let downloadId: number | undefined;
  try {
    downloadId = await browser.downloads.download({
      url,
      filename,
      saveAs: true,
    });
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }

  if (downloadId === undefined) {
    URL.revokeObjectURL(url);
    return 'cancelled';
  }

  try {
    return await waitForDownloadEnd(downloadId);
  } finally {
    URL.revokeObjectURL(url);
  }
}
