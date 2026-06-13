import { translate } from './i18n';

/** Create a basic system notification with the extension icon and translated copy.
 *  Pass `id` to address a specific notification (so it can be cleared/replaced later). */
export async function notify(options: {
  id?: string;
  titleKey: string;
  messageKey: string;
}): Promise<void> {
  const notification = {
    type: 'basic' as const,
    iconUrl: browser.runtime.getURL('/icon/128.png'),
    title: await translate(options.titleKey),
    message: await translate(options.messageKey),
  };
  if (options.id) {
    await browser.notifications.create(options.id, notification);
  } else {
    await browser.notifications.create(notification);
  }
}
