/**
 * Simple i18n for WOW3 (English only)
 */

window.translationsEn = {
  // Media Library
  'media_library': 'Media Library',
  'search_widgets_placeholder': 'Search media...',
  'add': 'Add',
  'delete': 'Delete',
  'home_page_name': 'All Photos',
  'media_lib': 'Media Library',
  'upload_pc': 'Upload from PC',

  // Common
  'ok': 'OK',
  'cancel': 'Cancel',
  'confirm': 'Confirm',
  'remove': 'Remove'
};

window.I18n = {
  currentLang: 'en',

  t: function(key, ...args) {
    const langSource = window.translationsEn;
    if (!langSource) return key;
    let translation = langSource[key] || key;

    // Handle basic %s replacements
    if (args.length > 0) {
      args.forEach(arg => {
        translation = translation.replace('%s', arg);
      });
    }

    return translation;
  }
};

/**
 * Global helper for translation
 */
const __ = (key, ...args) => window.I18n.t(key, ...args);

window.__ = __;
export default __;
