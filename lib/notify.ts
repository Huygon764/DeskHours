import { translate } from './i18n';

/** Create a basic system notification with the extension icon.
 *  Copy comes from i18n keys, except `message` which may be a raw string
 *  (used for user-provided alarm labels). Pass `id` to address a specific
 *  notification so it can be cleared/replaced later. */
export async function notify(options: {
  id?: string;
  titleKey: string;
  messageKey?: string;
  message?: string;
}): Promise<void> {
  const message =
    options.message ?? (options.messageKey ? await translate(options.messageKey) : '');
  const notification = {
    type: 'basic' as const,
    iconUrl: browser.runtime.getURL('/icon/128.png'),
    title: await translate(options.titleKey),
    message,
  };
  if (options.id) {
    await browser.notifications.create(options.id, notification);
  } else {
    await browser.notifications.create(notification);
  }
}
