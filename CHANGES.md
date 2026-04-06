# Changes

## 2026-04-06

### Update ES module imports to @wow/core

Updated 13 files under `apps/wow3/js/` to import shared modules from the
`@wow/core` package instead of relative paths. The following module paths were
replaced:

- `utils/dom.js` -> `@wow/core/utils/dom.js`
- `utils/events.js` -> `@wow/core/utils/events.js`
- `utils/constants.js` -> `@wow/core/utils/constants.js`
- `utils/positioning.js` -> `@wow/core/utils/positioning.js`
- `utils/toasts.js` -> `@wow/core/utils/toasts.js`
- `utils/settings.js` -> `@wow/core/utils/settings.js`
- `animations/definitions.js` -> `@wow/core/animations/definitions.js`
- `managers/AudioManager.js` -> `@wow/core/managers/AudioManager.js`

Files updated:
- `controllers/ElementController.js`
- `controllers/RecordingController.js`
- `controllers/SettingsController.js`
- `controllers/AnimationEditorController.js`
- `controllers/EditorController.js`
- `controllers/PlaybackController.js`
- `controllers/RemoteController.js`
- `controllers/SlideController.js`
- `views/RightSidebar.js`
- `animations/AnimationManager.js`
- `animations/migration.js`
- `utils/storage.js`
- `app.js`
