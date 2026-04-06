/**
 * Custom Dialog widget to replace native alert and confirm.
 */
class Dialog {
    /**
     * Shows an alert dialog.
     * @param {string} message - The message to display.
     * @param {string} title - The dialog title.
     * @returns {Promise<void>}
     */
    static alert(message, title = null) {
        return this.show({
            title: title || __('warning'),
            body: message,
            buttons: [
                { text: __('ok'), type: 'primary', value: true }
            ],
            onRender: (box) => {
                const btn = box.querySelector('.dialog-btn-primary');
                if (btn) btn.focus();
            }
        });
    }

    /**
     * Shows a confirmation dialog.
     * @param {string} message - The message to display.
     * @param {string} title - The dialog title.
     * @returns {Promise<boolean>}
     */
    static confirm(message, title = null) {
        return this.show({
            title: title || __('confirm'),
            body: message,
            buttons: [
                { text: __('cancel'), type: 'secondary', value: false },
                { text: __('confirm'), type: 'primary', value: true }
            ],
            onRender: (box) => {
                const btn = box.querySelector('.dialog-btn-primary');
                if (btn) btn.focus();
            }
        });
    }

    /**
     * Shows a prompt dialog.
     * @param {string} message - The message to display.
     * @param {string} defaultValue - The default input value.
     * @param {string} title - The dialog title.
     * @returns {Promise<string|null>}
     */
    static prompt(message, defaultValue = '', title = null) {
        return this.show({
            title: title || __('input'),
            body: `
                <div style="margin-bottom: 10px;">${message}</div>
                <input type="text" class="dialog-input" id="dialog-prompt-input" value="${defaultValue}">
            `,
            onRender: () => {
                const input = document.getElementById('dialog-prompt-input');
                if (input) {
                    input.focus();
                    input.select();
                }
            },
            buttons: [
                { text: __('cancel'), type: 'secondary', value: null },
                { text: __('ok'), type: 'primary', resolveInput: true }
            ]
        });
    }

    /**
     * Core method to show a dialog.
     * @param {Object} options - Dialog options.
     * @returns {Promise<any>}
     */
    static show(options) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'dialog-overlay';

            const box = document.createElement('div');
            box.className = `dialog-box ${options.boxClass || ''}`;

            let buttonsHtml = '';
            options.buttons.forEach((btn, index) => {
                buttonsHtml += `<button class="dialog-btn dialog-btn-${btn.type || 'primary'} ${btn.className || ''}" data-index="${index}">${btn.text}</button>`;
            });

            box.innerHTML = `
                <div class="dialog-header">${options.title || ''}</div>
                <div class="dialog-body">${options.body || ''}</div>
                <div class="dialog-footer">${buttonsHtml}</div>
            `;

            overlay.appendChild(box);
            document.body.appendChild(overlay);

            const close = (value) => {
                window.removeEventListener('keydown', handleKey);
                document.body.removeChild(overlay);
                resolve(value);
            };

            box.querySelectorAll('.dialog-btn').forEach(btn => {
                btn.onclick = () => {
                    const index = btn.dataset.index;
                    const btnConfig = options.buttons[index];
                    
                    if (btnConfig.resolveInput) {
                        const inputs = box.querySelectorAll('input, select, textarea');
                        let inputValues = {};
                        let firstValue = null;

                        inputs.forEach(input => {
                            const name = input.name || input.id;
                            let val = input.value;
                            
                            if (input.type === 'checkbox') {
                                val = input.checked;
                            } else if (input.type === 'radio') {
                                if (!input.checked) return;
                                val = input.value;
                            }

                            if (name) {
                                inputValues[name] = val;
                            }
                            if (firstValue === null) firstValue = val;
                        });

                        // For prompt dialogs (dialog-prompt-input), return raw value for backward compat.
                        // For custom dialogs, always return the full inputValues object.
                        const resultInput = inputValues['dialog-prompt-input'] !== undefined
                            ? firstValue
                            : inputValues;
                        
                        if (btnConfig.value !== undefined) {
                            close({ value: btnConfig.value, input: resultInput });
                        } else {
                            close(resultInput);
                        }
                    } else {
                        const val = btnConfig.value;
                        if (btnConfig.preventClose) {
                            // If we have an onClick callback in the config, call it
                            if (btnConfig.onClick) btnConfig.onClick(val);
                        } else {
                            close(val);
                        }
                    }
                };
            });

            if (options.onRender) options.onRender(box);

            // Handle Enter key for primary button or prompt
            const handleKey = (e) => {
                if (e.key === 'Enter') {
                    const primaryBtn = box.querySelector('.dialog-btn-primary');
                    if (primaryBtn) {
                        e.preventDefault();
                        e.stopPropagation();
                        primaryBtn.click();
                    }
                } else if (e.key === 'Escape') {
                    const secondaryBtn = box.querySelector('.dialog-btn-secondary');
                    e.preventDefault();
                    e.stopPropagation();
                    if (secondaryBtn) secondaryBtn.click();
                    else close(null);
                }
            };
            window.addEventListener('keydown', handleKey);
        });
    }
}

// Global helper for easy access
window.Dialog = Dialog;
