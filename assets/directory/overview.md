# Publish Child Items

Publish all the child items of a page in one go, straight from the Optimizely CMS (SaaS) editor,
instead of opening and publishing every child one by one.

## What it is for

Editors often update a whole section at once: a news listing and its articles, a product area
and its pages, a campaign hub and its landing pages. **Publish Child Items** adds a panel to the
CMS editor sidebar that lists the children of the item you are editing and publishes the ones
you choose.

## Benefits

- **Saves time:** publish 10, 20 or 50 child items with a couple of clicks.
- **Clear status:** every child shows *Draft*, *Ready*, *Published*, or which other language it exists in.
- **Safe:** only items with a draft newer than the live version can be selected, and you confirm before anything goes live.
- **Transparent:** progress while publishing, and a per-item result (with the reason when something fails).

## How to use it

1. Open a page or folder in the CMS editor.
2. Open the **Publish Child Items** panel in the sidebar.
3. Tick the children to publish, or **Select all drafts**.
4. Click **Publish selected**, then **Publish** to confirm.

Children are listed for the language you are editing, 10 at a time (**Load more** for the rest).

## Installation and setup

1. Install the app on your CMS (SaaS) instance from the App Directory.
2. In the CMS, go to **Settings > API Keys > Create API Key** and give the key rights to **publish** content.
3. In the app's **Settings** tab, enter the key's **Client ID** and **Client Secret** and click **Save and test**.
4. Enable the extension in the CMS. The panel appears in the editor sidebar.

## Data the app reads and changes

- **Reads** the child items of the item you are editing and their versions, through the CMS REST API.
- **Changes** only what you ask it to: it publishes the selected draft versions. Nothing is deleted.
- Publishes are made with the API key you configure, so the CMS history shows that API key as the publisher.
- The API key is stored in the app's encrypted settings. No content is stored outside your CMS.

## How often it runs

Only on demand, when an editor opens the panel or clicks **Publish**. There are no background jobs or scheduled imports.

## Requirements

- Optimizely CMS (SaaS) with CMS UI extensions enabled.
- A CMS API key with publish rights.
