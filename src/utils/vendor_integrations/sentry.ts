/* eslint-disable global-require */
import SentryType from '@sentry/node';
import { BUILD_VERSION_NOT_SANITIZED } from '../version';

// eslint-disable-next-line import/no-mutable-exports
let Sentry: typeof SentryType;
// @ts-ignore
if (process.browser) {
  Sentry = require('@sentry/browser');
} else {
  Sentry = require('@sentry/node');
}

try {
  if (!process.env.DEV_MODE) {
    Sentry.init({
      dsn: 'https://01d9c8f4220e4107992cfc3599c2f8e1@o403236.ingest.sentry.io/5265532',
      release: `soundsync_desktop_${BUILD_VERSION_NOT_SANITIZED}`,
    });
  }
} catch (e) {
  // do nothing as it is caused by electron not being available
}

export { Sentry };
