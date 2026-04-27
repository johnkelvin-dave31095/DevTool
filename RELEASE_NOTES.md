# Release Notes

## DevTool 0.1.0

DevTool streamlines time logging by turning Outlook calendar activity and completed Asana work into reviewed Clockify entries. This release introduces a guided workflow for authenticating, connecting a Clockify workspace, reviewing imported work, and pushing validated entries into Clockify with fewer manual edits.

## What the tool can do

### 1. User sign-in and per-user setup

- Supports user login before any sync work begins.
- Stores Clockify setup per user account.
- Lets each user save or update:
  - Clockify API key
  - Clockify workspace ID
- Includes an in-app settings area for revisiting Clockify credentials later.

### 2. Outlook to Clockify sync review

- Pulls Outlook calendar events for a selected date range.
- Uses a UTC-7 sync window for the Outlook review workflow.
- Builds a review table before anything is sent to Clockify.
- Prefills project and task suggestions from:
  - Outlook title parsing in `Project: Task` format
  - Saved preload rules
- Lets users:
  - include or skip individual rows
  - select Clockify projects and tasks
  - adjust hours
  - edit descriptions
  - add manual rows alongside Outlook events
- Validates rows before push so users can catch:
  - missing projects
  - invalid task selections
  - invalid time ranges
  - empty or incomplete descriptions
- Pushes only reviewed, valid entries to Clockify.
- Returns created vs. skipped results after each push.

### 3. Outlook preload rules

- Adds reusable rules that prefill Clockify values from Outlook event titles.
- Supports rule matching by:
  - exact title
  - title contains
- Supports rule scope options:
  - shared
  - user-only
- Lets users define default:
  - Clockify project
  - Clockify task
  - description template
- Lets users refresh, review, and delete existing rules from the UI.

### 4. Asana completed tickets to Clockify

- Loads completed Asana tasks for a selected date range.
- Pulls completed work for the logged-in user email.
- Builds a review table similar to the Outlook sync flow.
- Suggests Clockify projects by matching Asana project names.
- Lets users choose what goes into the generated description:
  - ticket link
  - title
  - section
  - task description
- Lets users:
  - include or skip rows
  - select project and task
  - adjust hours
  - edit descriptions before push
- Validates each row before sending entries to Clockify.
- Pushes reviewed Asana-based time entries directly into Clockify.

### 5. Clockify catalog and push support

- Loads the active Clockify workspace catalog, including projects and tasks.
- Supports listing archived projects when requested by the backend.
- Verifies that selected tasks belong to the selected project before creating entries.
- Creates billable Clockify time entries from reviewed rows.
- Surfaces partial-success results when some entries are created and others are skipped.

### 6. Product experience improvements

- Includes a dedicated login experience and authenticated app shell.
- Supports theme switching inside the main app.
- Provides inline error states, success toasts, progress states, and activity feedback during sync.
- Works across desktop and mobile layouts with dedicated navigation for smaller screens.

## Backend integrations included in this release

- Microsoft Outlook Calendar via Microsoft Graph
- Clockify workspace, projects, tasks, and time entries
- Asana completed task search

## Requirements and current expectations

- Users need a valid Clockify API key and workspace ID.
- Outlook sync depends on configured Microsoft Graph credentials and calendar access.
- Asana sync depends on an Asana API token available for the logged-in user.
- Outlook auto-matching works best when titles follow `Project: Task` or when preload rules are configured.
- All sync flows are review-first: entries are staged and validated before push instead of being auto-posted immediately.

## Summary

This release turns DevTool into a practical review-and-sync workspace for teams using Outlook, Asana, and Clockify together. Users can set up their account once, preload common mappings, review imported work safely, and push cleaner time entries with much less manual copy/paste.
