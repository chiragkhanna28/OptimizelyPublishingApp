import type {ExtensionContext} from '@optimizely/cms-extensibility-sdk';
import {CMS_EXTENSION_FUNCTION_ID} from '@shared/constants';
import type {Envelope} from '@shared/protocol';

export class BackendError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

const MESSAGES: Record<string, string> = {
  not_configured: 'The app has no CMS API key yet. Add the Client ID and Secret in the app settings (OCP App Directory).',
  bad_credentials: 'The CMS rejected the API key. Check the Client ID and Secret in the app settings.',
  forbidden: 'The CMS API key is not allowed to do this. Give it publish rights in CMS Settings > API Keys.',
  rate_limited: 'The CMS is rate limiting requests. Wait a few seconds, then try again.'
};

/**
 * Calls the app's backend function and unwraps the {ok, result | error} envelope.
 * invokeFunction only rejects on transport failure (timeout, cold start gone wrong...);
 * application errors come back as normal responses with a non-2xx status.
 */
export async function callBackend<T>(
  context: ExtensionContext,
  action: string,
  params: Record<string, unknown> = {}
): Promise<T> {
  let response: {statusCode: number; data?: unknown};
  try {
    response = await context.extension.invokeFunction(CMS_EXTENSION_FUNCTION_ID, {action, params});
  } catch (error) {
    throw new BackendError(
      'transport',
      `Could not reach the app backend${error instanceof Error ? `: ${error.message}` : ''}. Try again — the first call after a pause can take ~30 s.`
    );
  }
  const envelope = response.data as Envelope<T> | undefined;
  if (envelope && typeof envelope === 'object' && 'ok' in envelope) {
    if (envelope.ok) return envelope.result;
    throw new BackendError(envelope.error, MESSAGES[envelope.error] ?? envelope.message ?? `Request failed (${envelope.error}).`);
  }
  throw new BackendError('bad_response', `Unexpected backend response (HTTP ${response.statusCode}).`);
}
