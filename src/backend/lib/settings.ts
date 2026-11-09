import {storage, ValueHash} from '@zaiusinc/app-sdk';
import {CMS_BASE_URL} from '@shared/constants';

/** Settings-store key; matches the section key in forms/settings.yml. */
export const CMS_SETTINGS_KEY = 'cms_api';

export interface CmsSettings {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
}

export function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function loadCmsSettings(): Promise<CmsSettings> {
  const raw = await storage.settings.get<ValueHash>(CMS_SETTINGS_KEY);
  return {
    baseUrl: CMS_BASE_URL, // never configurable: the secret only goes to Optimizely
    clientId: str(raw.clientId),
    clientSecret: str(raw.clientSecret)
  };
}

export async function saveCmsSettings(settings: Pick<CmsSettings, 'clientId' | 'clientSecret'>): Promise<void> {
  // Only the credentials are stored. Overwriting the section also drops any old `baseUrl` value.
  await storage.settings.put(CMS_SETTINGS_KEY, {clientId: settings.clientId, clientSecret: settings.clientSecret});
}
