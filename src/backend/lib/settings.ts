import {storage, ValueHash} from '@zaiusinc/app-sdk';
import {DEFAULT_CMS_BASE_URL} from '@shared/constants';

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

export function normaliseBaseUrl(url: string): string {
  return (url || DEFAULT_CMS_BASE_URL).replace(/\/+$/, '');
}

export async function loadCmsSettings(): Promise<CmsSettings> {
  const raw = await storage.settings.get<ValueHash>(CMS_SETTINGS_KEY);
  return {
    baseUrl: normaliseBaseUrl(str(raw.baseUrl)),
    clientId: str(raw.clientId),
    clientSecret: str(raw.clientSecret)
  };
}

export async function saveCmsSettings(settings: CmsSettings): Promise<void> {
  await storage.settings.put(CMS_SETTINGS_KEY, {...settings});
}
