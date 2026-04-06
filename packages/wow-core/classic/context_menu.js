/**
 * ContextMenu — Unified context menu component.
 *
 * Provides a single reusable context menu with dark (default) and light themes.
 * Only one menu is open at a time; calling show() while another is open replaces it.
 *
 * Usage:
 *   ContextMenu.show(event, [
 *     { label: 'Edit', icon: 'edit', action: () => { ... } },
 *     { divider: true },
 *     { label: 'Delete', icon: 'delete', action: () => { ... }, disabled: true }
 *   ], { theme: 'light' });
 */
class ContextMenu {

  /** @type {HTMLDivElement|null} */
  static _el = null;

  /** @type {boolean} */
  static _listenersReady = false;

  /**
   * Show the context menu at the mouse position.
   * @param {MouseEvent} e - The triggering mouse event (used for clientX/clientY)
   * @param {Array<{label?: string, icon?: string, action?: Function, disabled?: boolean, divider?: boolean}>} items
   * @param {{ theme?: 'dark'|'light' }} [options]
   */
  static show(e, items, options = {}) {
    e.preventDefault();
    e.stopPropagation();

    const theme = options.theme || 'dark';

    // Create or reuse the singleton element
    let menu = ContextMenu._el;
    if (!menu) {
      menu = document.createElement('div');
      menu.id = 'ctx-menu';
      document.body.appendChild(menu);
      ContextMenu._el = menu;
    }

    // Apply theme class
    menu.className = theme === 'light' ? 'ctx-menu--light' : '';

    // Build items
    menu.innerHTML = '';
    items.forEach((item) => {
      if (item.divider) {
        const div = document.createElement('div');
        div.className = 'ctx-menu-divider';
        menu.appendChild(div);
        return;
      }

      const row = document.createElement('div');
      row.className = 'ctx-menu-item';

      if (item.disabled) {
        row.classList.add('ctx-menu-item--disabled');
      }

      row.innerHTML = `<i class="material-icons">${item.icon || ''}</i><span>${item.label || ''}</span>`;

      if (!item.disabled) {
        row.addEventListener('click', () => {
          ContextMenu.hide();
          if (item.action) item.action();
        });
      }

      menu.appendChild(row);
    });

    // Position at click coords, then clamp to viewport
    menu.style.display = 'block';
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;

    // Defer clamping so the element has layout
    requestAnimationFrame(() => {
      const rect = menu.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      if (rect.right > vw) menu.style.left = `${vw - rect.width - 4}px`;
      if (rect.bottom > vh) menu.style.top = `${vh - rect.height - 4}px`;
    });

    // Register global listeners once
    if (!ContextMenu._listenersReady) {
      document.addEventListener('click', ContextMenu._onClickOutside, true);
      document.addEventListener('contextmenu', ContextMenu._onClickOutside, true);
      document.addEventListener('keydown', ContextMenu._onKeyDown, true);
      ContextMenu._listenersReady = true;
    }
  }

  /** Hide the context menu if open. */
  static hide() {
    if (ContextMenu._el) {
      ContextMenu._el.style.display = 'none';
    }
  }

  /**
   * Global click-outside handler (registered once).
   * @param {MouseEvent} e
   */
  static _onClickOutside = (e) => {
    if (!ContextMenu._el) return;
    if (ContextMenu._el.style.display === 'none') return;
    if (ContextMenu._el.contains(e.target)) return;
    ContextMenu.hide();
  };

  /**
   * Global Escape key handler (registered once).
   * @param {KeyboardEvent} e
   */
  static _onKeyDown = (e) => {
    if (e.key === 'Escape') ContextMenu.hide();
  };
}

window.ContextMenu = ContextMenu;
