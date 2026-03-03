/**
 * AIService: Unified abstraction for multiple AI providers.
 * Supports OpenAI, Google Gemini, Ollama, and LM Studio.
 * Reads configuration from WOW3Settings and provides fetchModels() + generateSlides().
 */

const AI_PROVIDERS = {
  openai: {
    chat: 'https://api.openai.com/v1/chat/completions',
    models: 'https://api.openai.com/v1/models',
    requiresKey: true
  },
  google: {
    chat: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
    models: 'https://generativelanguage.googleapis.com/v1beta/models',
    requiresKey: true
  },
  ollama: {
    chat: '{baseUrl}/api/chat',
    models: '{baseUrl}/api/tags',
    defaultBaseUrl: 'http://localhost:11434'
  },
  lmstudio: {
    chat: '{baseUrl}/v1/chat/completions',
    models: '{baseUrl}/v1/models',
    defaultBaseUrl: 'http://localhost:1234'
  }
};

/** Layout presets for role-based element positioning on a 1280x720 canvas */
const LAYOUT_PRESETS = {
  title:      { x: 40, y: 80,  width: 1200, height: 120, fontSize: 64, fontWeight: 'bold',   alignment: 'center' },
  subtitle:   { x: 40, y: 220, width: 1200, height: 60,  fontSize: 32, fontWeight: 'normal', alignment: 'center' },
  heading:    { x: 60, y: 40,  width: 1160, height: 80,  fontSize: 48, fontWeight: 'bold',   alignment: 'left' },
  body:       { x: 60, y: 160, width: 1160, height: 480, fontSize: 28, fontWeight: 'normal', alignment: 'left' },
  list:       { x: 80, y: 160, width: 1120, height: 480, fontSize: 28, fontWeight: 'normal', alignment: 'left' },
  decoration: { x: 0,  y: 680, width: 1280, height: 40 },
  accent:     { x: 540, y: 600, width: 200, height: 50 }
};

const AIService = {
  /**
   * Read the AI configuration from WOW3Settings.
   * @returns {{ provider: string, apiKey: string, baseUrl: string, model: string }}
   */
  getConfig: function () {
    if (!window.WOW3Settings) return { provider: 'openai', apiKey: '', baseUrl: '', model: '' };
    return window.WOW3Settings.getSetting('ai') || { provider: 'openai', apiKey: '', baseUrl: '', model: '' };
  },

  /**
   * Check whether the AI service is properly configured.
   * @returns {boolean}
   */
  isConfigured: function () {
    const config = this.getConfig();
    if (!config.provider || !config.model) return false;
    const providerDef = AI_PROVIDERS[config.provider];
    if (!providerDef) return false;
    if (providerDef.requiresKey && !config.apiKey) return false;
    return true;
  },

  /**
   * Resolve a URL template by substituting {baseUrl} and {model} placeholders.
   * @param {string} template - URL template
   * @param {Object} config - AI config
   * @returns {string}
   */
  _resolveUrl: function (template, config) {
    const providerDef = AI_PROVIDERS[config.provider];
    const baseUrl = (config.baseUrl || providerDef.defaultBaseUrl || '').replace(/\/+$/, '');
    return template.replace('{baseUrl}', baseUrl).replace('{model}', config.model || '');
  },

  /**
   * Fetch available models from the configured provider.
   * @returns {Promise<string[]>} Array of model name strings
   */
  fetchModels: async function () {
    const config = this.getConfig();
    const providerDef = AI_PROVIDERS[config.provider];
    if (!providerDef) throw new Error('Unknown provider: ' + config.provider);

    const url = this._resolveUrl(providerDef.models, config);
    const headers = {};

    if (config.provider === 'openai') {
      if (!config.apiKey) throw new Error('API key is required for OpenAI');
      headers['Authorization'] = 'Bearer ' + config.apiKey;
    } else if (config.provider === 'google') {
      // Google uses query param for API key
    }

    const fetchUrl = config.provider === 'google' ? url + '?key=' + config.apiKey : url;

    const response = await fetch(fetchUrl, { headers });
    if (!response.ok) throw new Error('Failed to fetch models: ' + response.status);
    const data = await response.json();

    return this._parseModelsResponse(config.provider, data);
  },

  /**
   * Parse the models API response according to provider format.
   * @param {string} provider - Provider name
   * @param {Object} data - Raw API response
   * @returns {string[]}
   */
  _parseModelsResponse: function (provider, data) {
    switch (provider) {
      case 'openai':
      case 'lmstudio':
        return (data.data || []).map(m => m.id).sort();
      case 'google':
        return (data.models || [])
          .map(m => m.name?.replace('models/', '') || m.name)
          .filter(n => n)
          .sort();
      case 'ollama':
        return (data.models || []).map(m => m.name).sort();
      default:
        return [];
    }
  },

  /**
   * Generate slides from a user prompt using the configured AI provider.
   * @param {string} userPrompt - The user's natural language description
   * @returns {Promise<Object>} Parsed slide data with { slides: [...] }
   */
  generateSlides: async function (userPrompt) {
    const config = this.getConfig();
    const providerDef = AI_PROVIDERS[config.provider];
    if (!providerDef) throw new Error('Unknown provider: ' + config.provider);
    if (!config.model) throw new Error('No model selected');

    const systemPrompt = this._buildSystemPrompt();
    const url = this._resolveUrl(providerDef.chat, config);

    console.group('[AIService] generateSlides');
    console.log('[AIService] Provider:', config.provider, '| Model:', config.model);
    console.log('[AIService] System prompt:\n', systemPrompt);
    console.log('[AIService] User prompt:\n', userPrompt);

    let responseText;

    if (config.provider === 'google') {
      responseText = await this._callGoogle(url, config, systemPrompt, userPrompt);
    } else {
      responseText = await this._callOpenAICompatible(url, config, systemPrompt, userPrompt);
    }

    console.log('[AIService] Raw AI response:\n', responseText);

    const parsed = this._parseJSONResponse(responseText);
    console.log('[AIService] Parsed slides:', parsed);
    console.groupEnd();

    return parsed;
  },

  /**
   * Call an OpenAI-compatible chat endpoint (OpenAI, Ollama, LM Studio).
   * @param {string} url - Chat endpoint URL
   * @param {Object} config - AI config
   * @param {string} systemPrompt - System message
   * @param {string} userPrompt - User message
   * @returns {Promise<string>} Raw response text from the model
   */
  _callOpenAICompatible: async function (url, config, systemPrompt, userPrompt) {
    const headers = { 'Content-Type': 'application/json' };
    if (config.provider === 'openai' && config.apiKey) {
      headers['Authorization'] = 'Bearer ' + config.apiKey;
    }

    const body = {
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error('AI request failed (' + response.status + '): ' + errText.substring(0, 200));
    }

    const data = await response.json();

    // OpenAI/LMStudio format
    if (data.choices && data.choices[0]) {
      return data.choices[0].message?.content || '';
    }
    // Ollama format
    if (data.message) {
      return data.message.content || '';
    }

    throw new Error('Unexpected response format');
  },

  /**
   * Call the Google Gemini generateContent endpoint.
   * @param {string} url - Chat endpoint URL (with {model} already resolved)
   * @param {Object} config - AI config
   * @param {string} systemPrompt - System instruction
   * @param {string} userPrompt - User message
   * @returns {Promise<string>} Raw response text from the model
   */
  _callGoogle: async function (url, config, systemPrompt, userPrompt) {
    const fetchUrl = url + '?key=' + config.apiKey;

    const body = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userPrompt }] }],
      generationConfig: { temperature: 0.7 }
    };

    const response = await fetch(fetchUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error('AI request failed (' + response.status + '): ' + errText.substring(0, 200));
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    if (!candidate) throw new Error('No response from Google AI');

    return candidate.content?.parts?.[0]?.text || '';
  },

  /**
   * Parse the AI text response, stripping markdown fences and extracting JSON.
   * @param {string} text - Raw model output
   * @returns {Object} Parsed slide data { slides: [...] }
   */
  _parseJSONResponse: function (text) {
    if (!text) throw new Error('Empty response from AI');

    // Strip markdown code fences if present
    let cleaned = text.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
    cleaned = cleaned.trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      // Try to find a JSON object in the text
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch (e2) {
          throw new Error('Failed to parse AI response as JSON');
        }
      } else {
        throw new Error('No valid JSON found in AI response');
      }
    }

    if (!parsed.slides || !Array.isArray(parsed.slides)) {
      throw new Error('AI response missing "slides" array');
    }

    return parsed;
  },

  /**
   * Build the system prompt from the external AI_PROMPT_EXAMPLES file.
   * Falls back to a minimal prompt if the file is not loaded.
   * @returns {string}
   */
  _buildSystemPrompt: function () {
    if (window.AI_PROMPT_EXAMPLES && window.AI_PROMPT_EXAMPLES.SYSTEM_PROMPT) {
      return window.AI_PROMPT_EXAMPLES.SYSTEM_PROMPT;
    }
    // Minimal fallback
    return 'You are a presentation designer. Return ONLY valid JSON with { "slides": [ { "title": "...", "background": "#fff", "elements": [ { "type": "text", "content": "...", "role": "title", "style": {} } ] } ] }. Canvas is 1280x720. No markdown.';
  },

  /**
   * Resolve the position for an element: use explicit position if provided, else role-based layout.
   * @param {Object} el - AI element data
   * @param {Object} layout - Role-based layout preset
   * @returns {{ x: number, y: number, width: number, height: number, rotation: number }}
   */
  _resolvePosition: function (el, layout) {
    const pos = el.position || {};
    return {
      x: pos.x ?? layout.x,
      y: pos.y ?? layout.y,
      width: pos.width ?? layout.width,
      height: pos.height ?? layout.height,
      rotation: pos.rotation ?? 0
    };
  },

  /**
   * Build a font object from AI style data merged with layout defaults.
   * @param {Object} style - AI style object
   * @param {Object} layout - Role-based layout preset
   * @returns {Object} Font properties for WOW3 element
   */
  _buildFont: function (style, layout) {
    const font = {
      family: style?.fontFamily || 'Roboto',
      size: style?.fontSize || layout.fontSize || 28,
      color: style?.color || '#000000',
      weight: style?.fontWeight || layout.fontWeight || 'normal',
      style: style?.fontStyle || 'normal',
      decoration: style?.decoration || 'none',
      alignment: style?.alignment || layout.alignment || 'left',
      verticalAlign: style?.verticalAlign || 'top',
      colorAnimationSpeed: style?.colorAnimationSpeed ?? 0,
      colorAnimationType: style?.colorAnimationType || 'pingpong'
    };

    // Text shadow
    if (style?.shadow) {
      font.shadow = {
        enabled: true,
        color: style.shadow.color || '#000000',
        offsetX: style.shadow.offsetX ?? 2,
        offsetY: style.shadow.offsetY ?? 2,
        blur: style.shadow.blur ?? 4
      };
    }

    // Text stroke / outline
    if (style?.stroke) {
      font.stroke = {
        enabled: true,
        color: style.stroke.color || '#000000',
        width: style.stroke.width ?? 1
      };
    }

    return font;
  },

  /**
   * Convert AI-generated slide data into WOW3 Slide.fromJSON-compatible format.
   * Handles all element types: text, list, shape, image, video, link, countdown_timer.
   * @param {Object} aiSlide - A single slide from the AI response
   * @returns {Object} JSON compatible with Slide.fromJSON
   */
  convertToSlideJSON: function (aiSlide) {
    const slideJSON = {
      title: aiSlide.title || 'Untitled Slide',
      background: aiSlide.background || '#ffffff',
      backgroundAnimationSpeed: aiSlide.backgroundAnimationSpeed ?? 0,
      backgroundAnimationType: aiSlide.backgroundAnimationType || 'pingpong',
      autoPlay: aiSlide.autoPlay ?? false,
      autoPlayDuration: aiSlide.autoPlayDuration ?? 5,
      elements: []
    };

    if (!aiSlide.elements) return slideJSON;

    aiSlide.elements.forEach((el) => {
      const role = el.role || 'body';
      const layout = LAYOUT_PRESETS[role] || LAYOUT_PRESETS.body;
      const position = this._resolvePosition(el, layout);

      if (el.type === 'text') {
        const textProps = {
          text: el.content || '',
          font: this._buildFont(el.style, layout)
        };

        // Text background image (image fill for text)
        if (el.style?.backgroundImage || el.backgroundImage) {
          const bgImg = el.style?.backgroundImage || el.backgroundImage;
          textProps.backgroundImage = {
            url: bgImg.url || '',
            direction: bgImg.direction || 'none',
            speed: bgImg.speed ?? 0
          };
        }

        slideJSON.elements.push({
          type: 'text',
          position,
          properties: textProps
        });
      } else if (el.type === 'list') {
        slideJSON.elements.push({
          type: 'list',
          position,
          properties: {
            listType: el.listType || 'unordered',
            items: el.items || ['Item 1'],
            font: this._buildFont(el.style, layout)
          }
        });
      } else if (el.type === 'shape') {
        slideJSON.elements.push({
          type: 'shape',
          position,
          properties: {
            shapeType: el.shapeType || 'rectangle',
            fillColor: el.style?.fillColor || el.fillColor || '#1565C0',
            strokeColor: el.style?.strokeColor || '#000000',
            strokeWidth: el.style?.strokeWidth ?? 0,
            fillColorAnimationSpeed: el.style?.fillColorAnimationSpeed ?? 0
          }
        });
      } else if (el.type === 'image') {
        slideJSON.elements.push({
          type: 'image',
          position,
          properties: {
            url: el.url || '',
            objectFit: el.style?.objectFit || 'cover',
            clipShape: el.clipShape || 'none',
            shapeBorderWidth: el.style?.shapeBorderWidth ?? 0,
            shapeBorderColor: el.style?.shapeBorderColor || '#000000',
            borderRadius: el.style?.borderRadius ?? 0,
            shapeScale: el.style?.shapeScale ?? 100
          }
        });
      } else if (el.type === 'video') {
        slideJSON.elements.push({
          type: 'video',
          position,
          properties: {
            url: el.url || '',
            autoplay: el.style?.autoplay ?? false,
            loop: el.style?.loop ?? false,
            muted: el.style?.muted ?? false,
            controls: el.style?.controls ?? true
          }
        });
      } else if (el.type === 'link') {
        slideJSON.elements.push({
          type: 'link',
          position,
          properties: {
            text: el.content || 'Click Here',
            url: el.url || '#',
            target: '_blank',
            backgroundColor: el.style?.backgroundColor || '#2196F3',
            textColor: el.style?.textColor || '#ffffff',
            borderRadius: el.style?.borderRadius ?? 4,
            font: {
              family: el.style?.fontFamily || 'Roboto',
              size: el.style?.fontSize || 18,
              weight: el.style?.fontWeight || '500'
            }
          }
        });
      } else if (el.type === 'countdown_timer') {
        slideJSON.elements.push({
          type: 'countdown_timer',
          position,
          properties: {
            duration: el.duration || 300,
            background: el.style?.background || '#000000',
            borderColor: el.style?.borderColor || '#333333',
            borderWidth: el.style?.borderWidth ?? 2,
            borderRadius: el.style?.borderRadius ?? 8,
            backgroundAnimationSpeed: el.style?.backgroundAnimationSpeed ?? 0,
            backgroundAnimationType: el.style?.backgroundAnimationType || 'pingpong',
            font: {
              size: el.style?.fontSize || 48,
              color: el.style?.color || '#ffffff'
            }
          }
        });
      }
    });

    return slideJSON;
  }
};

window.AIService = AIService;
