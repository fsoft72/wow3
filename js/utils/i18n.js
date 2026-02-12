/**
 * Simple i18n passthrough (English only for now)
 */

const translations = {
  'media_library': 'Media Library',
  'search_widgets_placeholder': 'Search media...',
  'add': 'Add',
  'delete': 'Delete',
  'home_page_name': 'All Photos'
};

const __ = (key) => translations[key] || key;

window.__ = __;
export default __;
