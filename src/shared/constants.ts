/** Key of the backend function under `functions:` in app.yml. */
export const CMS_EXTENSION_FUNCTION_ID = 'cms_extension';

export const DEFAULT_CMS_BASE_URL = 'https://api.cms.optimizely.com';

/** Children loaded per "page" in the sidebar. Each child costs one CMS call, so keep this small
 * enough to stay well inside the ~59 s invokeFunction limit (cold start alone can take ~30 s). */
export const CHILDREN_PAGE_SIZE = 10;

/** Children published per backend call. The UI loops over batches and shows progress. */
export const PUBLISH_BATCH_SIZE = 5;
