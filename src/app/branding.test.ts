import { describe, expect, it } from 'vitest';
import { APP_NAME, APP_TAGLINE, DISCLAIMER } from './branding';

describe('branding', () => {
  it('names the app Hopscore', () => {
    expect(APP_NAME).toBe('Hopscore');
  });

  it('uses "Dixit" only in the tagline', () => {
    expect(APP_TAGLINE).toBe('Dixit Score Tracker');
    expect(APP_NAME).not.toMatch(/dixit/i);
  });

  it('says the app is not affiliated with Libellud', () => {
    expect(DISCLAIMER).toBe('Not affiliated with or endorsed by Libellud. Dixit is a trademark of Libellud.');
  });
});
