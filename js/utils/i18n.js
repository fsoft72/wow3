/**
 * Simple i18n for WOW3 (English only)
 */

export const translationsEn = {
  // Media Library
  'media_library': 'Media Library',
  'search_widgets_placeholder': 'Search media...',
  'add': 'Add',
  'delete': 'Delete',
  'home_page_name': 'All Photos',
  'media_lib': 'Media Library',
  'upload_pc': 'Upload from PC',

  // Presentation Manager
  'presentations': 'Presentations',
  'search_presentations': 'Search presentations...',
  'new_presentation': 'New Presentation',

  // Slide Importer
  'insert_slides': 'Insert Slides',
  'select_all': 'Select All',
  'select_none': 'Select None',
  'import_slides': 'Import',
  'load_from_file': 'Load from file',

  // Dialog
  'ok': 'OK',
  'cancel': 'Cancel',
  'confirm': 'Confirm',
  'warning': 'Warning',
  'input': 'Input',
  'remove': 'Remove'
};

export const I18n = {
  currentLang: 'en',

  t: function(key, ...args) {
    const langSource = translationsEn;
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
export const __ = (key, ...args) => I18n.t(key, ...args);
