/**
 * WOW3 Elements Tree
 * Tree view of page elements with animation controls
 */

export class ElementsTree {
  constructor() {
    this.container = null;
  }

  /**
   * Initialize elements tree
   */
  async init() {
    console.log('Initializing ElementsTree...');

    this.container = document.getElementById('elements-tree');

    console.log('ElementsTree initialized');
  }

  /**
   * Render elements tree
   * @param {Array} elements - Array of elements
   */
  render(elements) {
    if (!this.container) return;

    this.container.innerHTML = '';

    if (!elements || elements.length === 0) {
      this.container.innerHTML = '<p class="elements-tree-empty">No elements on this slide</p>';
      return;
    }

    elements.forEach((element) => {
      const item = this.createTreeItem(element, 0);
      this.container.appendChild(item);

      // Render children
      element.children.forEach((child) => {
        const childItem = this.createTreeItem(child, 1);
        this.container.appendChild(childItem);
      });
    });
  }

  /**
   * Create tree item
   * @param {Element} element - Element
   * @param {number} level - Nesting level
   * @returns {HTMLElement} Tree item element
   */
  createTreeItem(element, level) {
    const item = document.createElement('div');
    item.className = `tree-item level-${level}`;
    item.dataset.elementId = element.id;

    // Animation badge — shows count of animations targeting this element
    const badge = document.createElement('span');
    const animCount = this._getAnimationCount(element.id);
    badge.className = `animation-badge ${animCount === 0 ? 'empty' : ''}`;
    badge.textContent = animCount > 0 ? String(animCount) : '0';
    badge.title = animCount > 0 ? `${animCount} animation(s)` : 'No animations';

    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openAnimationInspector(element);
    });

    // Element icon
    const icon = document.createElement('i');
    icon.className = 'material-icons tree-item-icon';
    icon.textContent = this.getElementIcon(element.type);

    // Element name
    const name = document.createElement('span');
    name.className = 'tree-item-name';
    name.textContent = this.getElementName(element);

    item.appendChild(badge);
    item.appendChild(icon);
    item.appendChild(name);

    // Click to select element
    item.addEventListener('click', (e) => {
      if (
        e.target === item ||
        e.target === icon ||
        e.target === name
      ) {
        if (window.app && window.app.editor && window.app.editor.elementController) {
          window.app.editor.elementController.selectElement(element);
        }
      }
    });

    return item;
  }

  /**
   * Get element icon
   * @param {string} type - Element type
   * @returns {string} Material icon name
   */
  getElementIcon(type) {
    const icons = {
      text: 'text_fields',
      image: 'image',
      video: 'videocam',
      audio: 'audiotrack',
      shape: 'crop_square',
      list: 'list',
      link: 'link'
    };

    return icons[type] || 'widgets';
  }

  /**
   * Get element name
   * @param {Element} element - Element
   * @returns {string} Element name
   */
  getElementName(element) {
    if (element.name) return element.name;

    switch (element.type) {
      case 'text':
        return element.properties.text?.substring(0, 25) || 'Text';

      case 'image':
        return 'Image';

      case 'video':
        return 'Video';

      case 'audio':
        return 'Audio';

      case 'shape':
        return `Shape (${element.properties.shapeType})`;

      case 'list':
        return `List (${element.properties.listType})`;

      case 'link':
        return element.properties.text || 'Link';

      default:
        return element.type;
    }
  }

  /**
   * Open animation inspector for an element
   * @param {Object} element - Element model
   */
  openAnimationInspector(element) {
    if (window.app && window.app.editor && window.app.editor.animationEditorController) {
      const animCtrl = window.app.editor.animationEditorController;
      animCtrl.showPanel();
      animCtrl.switchPanelTab('anim');
      animCtrl.showInspector(element);
    }
  }

  /**
   * Get the number of animations targeting an element on the active slide
   * @param {string} elementId - Element ID
   * @returns {number}
   * @private
   */
  _getAnimationCount(elementId) {
    if (!window.app || !window.app.editor) return 0;
    const slide = window.app.editor.getActiveSlide();
    if (!slide || !slide.animationSequence) return 0;
    return slide.animationSequence.filter((a) => a.targetElementId === elementId).length;
  }
}

export default ElementsTree;
