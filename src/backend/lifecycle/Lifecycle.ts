import {
  AuthorizationGrantResult,
  CanUninstallResult,
  Lifecycle as AppLifecycle,
  LifecycleResult,
  LifecycleSettingsResult,
  logger,
  Request as AppRequest,
  SubmittedFormData
} from '@zaiusinc/app-sdk';
import {CmsError, requestToken} from '../lib/cmsApi';
import {CMS_SETTINGS_KEY, loadCmsSettings, normaliseBaseUrl, saveCmsSettings, str} from '../lib/settings';

export class Lifecycle extends AppLifecycle {
  public async onInstall(): Promise<LifecycleResult> {
    return {success: true};
  }

  public async onUpgrade(_fromVersion: string): Promise<LifecycleResult> {
    return {success: true};
  }

  public async onFinalizeUpgrade(_fromVersion: string): Promise<LifecycleResult> {
    return {success: true};
  }

  public async onAfterUpgrade(): Promise<LifecycleResult> {
    return {success: true};
  }

  public async canUninstall(): Promise<CanUninstallResult> {
    return {uninstallable: true};
  }

  public async onUninstall(): Promise<LifecycleResult> {
    return {success: true};
  }

  /** Runs when the settings form (forms/settings.yml) is submitted in the OCP App Directory. */
  public async onSettingsForm(
    section: string,
    action: string,
    formData: SubmittedFormData
  ): Promise<LifecycleSettingsResult> {
    const result = new LifecycleSettingsResult();
    if (section !== CMS_SETTINGS_KEY || action !== 'save') {
      logger.warn('Unsupported section/action', section, action);
      return result;
    }

    const saved = await loadCmsSettings();
    const settings = {
      baseUrl: normaliseBaseUrl(str(formData.baseUrl)),
      clientId: str(formData.clientId),
      // A blank secret field keeps the stored secret.
      clientSecret: str(formData.clientSecret) || saved.clientSecret
    };

    if (!settings.clientId) return result.addError('clientId', 'Client ID is required.');
    if (!settings.clientSecret) return result.addError('clientSecret', 'Client Secret is required.');

    try {
      await requestToken(settings);
    } catch (error) {
      const message = error instanceof CmsError ? error.message : 'Could not reach the CMS token endpoint.';
      logger.warn('CMS credential test failed', message);
      return result
        .addError('clientSecret', 'The CMS rejected these credentials.')
        .addToast('danger', `Not saved. ${message}`);
    }

    await saveCmsSettings(settings);
    return result.addToast('success', 'Saved. The CMS accepted the API key.');
  }

  public async onAuthorizationRequest(
    _section: string,
    _formData: SubmittedFormData
  ): Promise<LifecycleSettingsResult> {
    return new LifecycleSettingsResult().addToast('danger', 'OAuth is not supported.');
  }

  public async onAuthorizationGrant(_request: AppRequest): Promise<AuthorizationGrantResult> {
    return new AuthorizationGrantResult('').addToast('danger', 'OAuth is not supported.');
  }
}
