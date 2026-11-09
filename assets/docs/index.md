# Publish Child Items

## Setup

1. In the CMS (SaaS), go to **Settings > API Keys > Create API Key**. Give the key rights to **publish** content.
   A key with read-only rights cannot see drafts, so the panel would show no publishable items.
2. Install this app on your CMS instance.
3. Open the app's **Settings** tab, paste the **Client ID** and **Client Secret**, and click **Save and test**.
   The app checks the key with the CMS before saving it.
4. Enable the extension in the CMS, open a page, and open the **Publish Child Items** panel in the sidebar.

## Using the panel

| Badge | Meaning | Selectable |
|---|---|---|
| Draft | Has a draft newer than the live version (or was never published) | Yes |
| Ready | Has a "ready to publish" version | Yes |
| Published | Live, no newer draft | No |
| Only fr (etc.) | Exists only in other languages | No |
| No version | No version you can see in this language | No |
| Error | Could not be loaded (for example the CMS was busy); click **Refresh** | No |

## Notes

- Only **direct children** are listed, in the language you are editing.
- Publishes are made as the API key, so the CMS history shows the API client, not the editor.
- The first action after a quiet period can take up to ~30 seconds while the app starts.
- If the CMS limits the number of requests, the app retries automatically. Items that still fail show **Error**.

## Troubleshooting

- **"No CMS API key configured"**: add the Client ID and Secret in the app's Settings tab.
- **"The CMS rejected the API key"**: check the Client ID and Secret, or create a new key.
- **"Not allowed"**: give the API key publish rights in CMS **Settings > API Keys**.
- Logs are available in the app's **Troubleshooting** tab in the App Directory.
