import * as App from '@zaiusinc/app-sdk';
import {logger} from '@zaiusinc/app-sdk';
import {PUBLISH_BATCH_SIZE} from '@shared/constants';
import type {Envelope, PublishRequestItem, StatusResult} from '@shared/protocol';
import {listChildren, publishVersions} from '../lib/children';
import {CmsError} from '../lib/cmsApi';
import {loadCmsSettings, str} from '../lib/settings';

interface RequestBody {
  action?: unknown;
  params?: unknown;
}

function ok<T>(result: T): Envelope<T> {
  return {ok: true, result};
}

function fail(error: string, message?: string): Envelope<never> {
  return message ? {ok: false, error, message} : {ok: false, error};
}

const CONTENT_KEY = /^[0-9a-fA-F-]{32,36}$/;

/**
 * Private backend for the "Publish Child Items" sidebar (accepts: cms_ui_extension).
 * The UI sends {action, params}; we always answer with an {ok, result | error} envelope.
 *
 * Note: App.Response takes the STATUS FIRST, then the body.
 */
export class PublishChildrenBackend extends App.Function {
  public async perform(): Promise<App.Response> {
    const body = (this.request.bodyJSON ?? {}) as RequestBody;
    const action = typeof body.action === 'string' ? body.action : '';
    const params = (body.params ?? {}) as Record<string, unknown>;

    try {
      switch (action) {
      case 'status':
        return await this.status();
      case 'listChildren':
        return await this.listChildren(params);
      case 'publish':
        return await this.publish(params);
      default:
        return new App.Response(400, fail('unknown_action', action));
      }
    } catch (error) {
      // Never let an exception escape: the CMS would only show a generic failure.
      if (error instanceof CmsError) {
        logger.warn('CMS error', action, error.code, error.message);
        return new App.Response(error.status, fail(error.code, error.message));
      }
      logger.error('PublishChildrenBackend failure', action, error);
      return new App.Response(500, fail('internal_error', error instanceof Error ? error.message : undefined));
    }
  }

  private async status(): Promise<App.Response> {
    const settings = await loadCmsSettings();
    const result: StatusResult = {
      configured: Boolean(settings.clientId && settings.clientSecret),
      baseUrl: settings.baseUrl,
      clientId: settings.clientId || null
    };
    return new App.Response(200, ok(result));
  }

  private async listChildren(params: Record<string, unknown>): Promise<App.Response> {
    // Children are returned with their versions in ALL locales; the UI picks the language.
    const key = str(params.key);
    if (!CONTENT_KEY.test(key)) return new App.Response(400, fail('bad_key', 'Missing or invalid content key.'));
    const pageIndex = Math.max(0, Math.floor(Number(params.pageIndex) || 0));
    const result = await listChildren(key, pageIndex);
    return new App.Response(200, ok(result));
  }

  private async publish(params: Record<string, unknown>): Promise<App.Response> {
    // Publishing is limited to children of the item open in the editor (checked per item).
    const parentKey = str(params.parentKey);
    if (!CONTENT_KEY.test(parentKey)) {
      return new App.Response(400, fail('bad_parent', 'Missing or invalid parent content key.'));
    }
    const raw = Array.isArray(params.items) ? params.items : [];
    const items: PublishRequestItem[] = raw
      .map((item) => ({key: str((item as Record<string, unknown>)?.key), version: str((item as Record<string, unknown>)?.version)}))
      .filter((item) => CONTENT_KEY.test(item.key) && /^[\w.-]+$/.test(item.version));

    if (items.length === 0) return new App.Response(400, fail('nothing_to_publish'));
    if (items.length > PUBLISH_BATCH_SIZE) {
      return new App.Response(400, fail('batch_too_large', `Send at most ${PUBLISH_BATCH_SIZE} items per call.`));
    }

    const results = await publishVersions(parentKey, items);
    logger.info('Published batch', results.map((r) => `${r.key}@${r.version}:${r.status}`).join(', '));
    return new App.Response(200, ok({results}));
  }
}
