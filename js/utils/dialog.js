/**
 * Simple Dialog utility for prompts and confirmations
 */

const Dialog = {
  /**
   * Show prompt dialog
   * @param {string} message - Prompt message
   * @param {string} defaultValue - Default input value
   * @returns {Promise<string|null>} User input or null if cancelled
   */
  prompt: async function(message, defaultValue = '') {
    return new Promise((resolve) => {
      const result = window.prompt(message, defaultValue);
      resolve(result);
    });
  },

  /**
   * Show confirmation dialog
   * @param {string} message - Confirmation message
   * @returns {Promise<boolean>} True if confirmed, false otherwise
   */
  confirm: async function(message) {
    return new Promise((resolve) => {
      const result = window.confirm(message);
      resolve(result);
    });
  }
};

window.Dialog = Dialog;
export default Dialog;
