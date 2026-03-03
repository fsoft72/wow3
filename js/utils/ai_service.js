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
  title:      { x: 40, y: 80,  width: 1200, height: 100, fontSize: 64, fontWeight: 'bold',   alignment: 'center' },
  subtitle:   { x: 40, y: 220, width: 1200, height: 60,  fontSize: 32, fontWeight: 'normal', alignment: 'center' },
  heading:    { x: 60, y: 40,  width: 1160, height: 80,  fontSize: 48, fontWeight: 'bold',   alignment: 'left' },
  body:       { x: 60, y: 180, width: 1160, height: 460, fontSize: 28, fontWeight: 'normal', alignment: 'left' },
  list:       { x: 60, y: 180, width: 1160, height: 460, fontSize: 28, fontWeight: 'normal', alignment: 'left' },
  decoration: { x: 0,  y: 680, width: 1280, height: 40 }
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
    let responseText;

    if (config.provider === 'google') {
      responseText = await this._callGoogle(url, config, systemPrompt, userPrompt);
    } else {
      responseText = await this._callOpenAICompatible(url, config, systemPrompt, userPrompt);
    }

    return this._parseJSONResponse(responseText);
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
   * Build the system prompt that instructs the AI to return structured slide JSON.
   * @returns {string}
   */
  _buildSystemPrompt: function () {
    return `You are a presentation designer. Given a user's description, create a structured JSON presentation.

Return ONLY valid JSON with this exact structure (no markdown, no explanation):
{
  "slides": [
    {
      "title": "Slide Title",
      "background": "#ffffff",
      "elements": [
        {
          "type": "text",
          "content": "The actual text content",
          "role": "title|subtitle|heading|body",
          "style": {
            "fontSize": 64,
            "fontWeight": "bold|normal",
            "color": "#000000",
            "alignment": "left|center|right"
          }
        },
        {
          "type": "list",
          "listType": "ordered|unordered",
          "items": ["Item 1", "Item 2", "Item 3"],
          "role": "list",
          "style": {
            "fontSize": 28,
            "fontWeight": "normal",
            "color": "#333333",
            "alignment": "left"
          }
        },
        {
          "type": "shape",
          "shapeType": "rectangle|circle|triangle|line",
          "fillColor": "#hex",
          "role": "decoration"
        }
      ]
    }
  ]
}

Rules:
- The canvas is 1280x720 pixels
- Use role to indicate the purpose of each element: "title", "subtitle", "heading", "body", "list", "decoration"
- Each slide should have a clear visual hierarchy
- Title slides should use "title" and optionally "subtitle" roles
- Content slides should use "heading" for the slide heading and "body" or "list" for content
- Use shapes sparingly for decoration (bottom bars, accent rectangles)
- Choose professional, readable color schemes
- Return 3-10 slides depending on content complexity
- The first slide should be a title slide
- Keep text concise and presentation-friendly (bullet points, short phrases)
- IMPORTANT: Return ONLY the JSON object, no wrapping text or markdown`;
  },

  /**
   * Convert AI-generated slide data into WOW3 Slide.fromJSON-compatible format.
   * @param {Object} aiSlide - A single slide from the AI response
   * @returns {Object} JSON compatible with Slide.fromJSON
   */
  convertToSlideJSON: function (aiSlide) {
    const slideJSON = {
      title: aiSlide.title || 'Untitled Slide',
      background: aiSlide.background || '#ffffff',
      elements: []
    };

    if (!aiSlide.elements) return slideJSON;

    aiSlide.elements.forEach((el) => {
      const role = el.role || 'body';
      const layout = LAYOUT_PRESETS[role] || LAYOUT_PRESETS.body;

      if (el.type === 'text') {
        slideJSON.elements.push({
          type: 'text',
          position: {
            x: layout.x,
            y: layout.y,
            width: layout.width,
            height: layout.height
          },
          properties: {
            text: el.content || '',
            font: {
              family: 'Roboto',
              size: el.style?.fontSize || layout.fontSize,
              color: el.style?.color || '#000000',
              weight: el.style?.fontWeight || layout.fontWeight,
              alignment: el.style?.alignment || layout.alignment
            }
          }
        });
      } else if (el.type === 'list') {
        slideJSON.elements.push({
          type: 'list',
          position: {
            x: layout.x,
            y: layout.y,
            width: layout.width,
            height: layout.height
          },
          properties: {
            listType: el.listType || 'unordered',
            items: el.items || ['Item 1'],
            font: {
              family: 'Roboto',
              size: el.style?.fontSize || layout.fontSize,
              color: el.style?.color || '#333333',
              weight: el.style?.fontWeight || layout.fontWeight,
              alignment: el.style?.alignment || layout.alignment
            }
          }
        });
      } else if (el.type === 'shape') {
        const decoLayout = LAYOUT_PRESETS.decoration;
        slideJSON.elements.push({
          type: 'shape',
          position: {
            x: decoLayout.x,
            y: decoLayout.y,
            width: decoLayout.width,
            height: decoLayout.height
          },
          properties: {
            shapeType: el.shapeType || 'rectangle',
            fillColor: el.fillColor || '#1565C0'
          }
        });
      }
    });

    return slideJSON;
  }
};

window.AIService = AIService;
