# WOW Elements - Presentation JSON Schema Rules

> Comprehensive reference for generating valid `presentation.json` files.
> Derived from analyzing the full feature set of the WOW Elements format.

---

## 1. Top-Level Structure

```json
{
  "id": "presentation_{timestamp}_{randomAlphanumeric}",
  "title": "string",
  "currentSlideIndex": 0,
  "metadata": { ... },
  "slides": [ ... ],
  "shells": [],
  "defaultShellId": null
}
```

| Field              | Type     | Description                                      |
|--------------------|----------|--------------------------------------------------|
| `id`               | string   | Unique ID: `presentation_{unixMs}_{9charAlphaNum}` |
| `title`            | string   | Presentation title                               |
| `currentSlideIndex`| number   | Zero-based index of the active slide             |
| `metadata`         | object   | Creation/modification metadata                   |
| `slides`           | array    | Ordered array of slide objects                   |
| `shells`           | array    | Array of shell objects (reusable overlays)        |
| `defaultShellId`   | string \| null | ID of the default shell, or `null`          |

---

## 2. Metadata

```json
{
  "created": "2026-03-03T17:42:37.416Z",
  "modified": "2026-03-03T18:22:59.665Z",
  "author": "",
  "version": "1.0.0"
}
```

| Field      | Type   | Description                          |
|------------|--------|--------------------------------------|
| `created`  | string | ISO 8601 datetime (UTC)              |
| `modified` | string | ISO 8601 datetime (UTC), auto-updated|
| `author`   | string | Author name (can be empty)           |
| `version`  | string | Semver version string                |

---

## 3. Slide Structure

```json
{
  "id": "slide_{timestamp}_{randomAlphanumeric}",
  "title": "string",
  "background": "#ffffff",
  "backgroundAnimationSpeed": 0,
  "backgroundAnimationType": "pingpong",
  "visible": true,
  "shellId": null,
  "shellMode": "above",
  "autoPlay": false,
  "autoPlayDuration": 5,
  "thumbnailId": "thumb_{timestamp}",
  "elements": [ ... ],
  "animationSequence": []
}
```

| Field                      | Type          | Values / Description                                      |
|----------------------------|---------------|-----------------------------------------------------------|
| `id`                       | string        | Unique ID: `slide_{unixMs}_{9charAlphaNum}`               |
| `title`                    | string        | Human-readable slide name                                 |
| `background`               | string        | CSS color: hex (`#ffffff`), gradient, or color name        |
| `backgroundAnimationSpeed` | number        | `0` = static, `>0` = animated (seconds per cycle)         |
| `backgroundAnimationType`  | string        | `"pingpong"` (animates back and forth)                    |
| `visible`                  | boolean       | Whether the slide is visible in the presentation          |
| `shellId`                  | string \| null| ID of an attached shell overlay, or `null`                |
| `shellMode`                | string        | `"above"` — shell renders above slide content             |
| `autoPlay`                 | boolean       | Whether slide auto-advances                               |
| `autoPlayDuration`         | number        | Seconds before auto-advancing (when `autoPlay` is `true`) |
| `thumbnailId`              | string        | Unique thumbnail ID: `thumb_{unixMs}`                     |
| `elements`                 | array         | Ordered array of element objects (render order = array order) |
| `animationSequence`        | array         | Ordered animation steps (can be empty)                    |

---

## 4. Element — Common Fields

All elements share this base structure regardless of type:

```json
{
  "id": "element_{timestamp}_{randomAlphanumeric}",
  "type": "text | image | shape",
  "name": "",
  "position": { ... },
  "properties": { ... },
  "inEffect": null,
  "outEffect": null,
  "hiddenInEditor": false,
  "children": []
}
```

| Field           | Type          | Description                                          |
|-----------------|---------------|------------------------------------------------------|
| `id`            | string        | Unique ID: `element_{unixMs}_{9charAlphaNum}`        |
| `type`          | string        | **`"text"`**, **`"image"`**, or **`"shape"`**        |
| `name`          | string        | Optional display name (can be empty)                 |
| `position`      | object        | Position and dimensions (see §4.1)                   |
| `properties`    | object        | Type-specific properties (see §5, §6, §7)            |
| `inEffect`      | object \| null| Entry animation effect, or `null` for none           |
| `outEffect`     | object \| null| Exit animation effect, or `null` for none            |
| `hiddenInEditor`| boolean       | If `true`, element is hidden in the editor view      |
| `children`      | array         | Nested child elements (same element structure)       |

### 4.1 Position Object

```json
{
  "x": 70,
  "y": 51,
  "width": 1135,
  "height": 93,
  "rotation": 0
}
```

| Field      | Type   | Description                                                  |
|------------|--------|--------------------------------------------------------------|
| `x`        | number | Horizontal position in pixels (can be decimal)               |
| `y`        | number | Vertical position in pixels (can be decimal)                 |
| `width`    | number | Width in pixels (can be decimal)                             |
| `height`   | number | Height in pixels (can be decimal)                            |
| `rotation` | number | Rotation in degrees, `0`–`359`. `0` = no rotation            |

> **Note:** Coordinates are relative to the slide canvas. Rotation is clockwise.

---

## 5. Text Element (`type: "text"`)

### 5.1 Properties

```json
{
  "font": { ... },
  "text": "The visible text content",
  "editable": true,
  "backgroundImage": { ... }
}
```

| Field            | Type    | Description                                    |
|------------------|---------|------------------------------------------------|
| `font`           | object  | Full font/text styling (see §5.2)              |
| `text`           | string  | The text content to display                    |
| `editable`       | boolean | Whether the text is editable at runtime        |
| `backgroundImage`| object  | Image used as text fill/background (see §5.3)  |

### 5.2 Font Object (shared by all element types)

Every element includes a `font` object in `properties`, even if it's not a text element (it serves as inherited defaults).

```json
{
  "family": "Roboto",
  "size": 48,
  "color": "#000000",
  "style": "normal",
  "weight": "normal",
  "decoration": "none",
  "alignment": "left",
  "verticalAlign": "top",
  "shadow": { ... },
  "stroke": { ... },
  "colorAnimationSpeed": 0,
  "colorAnimationType": "pingpong"
}
```

| Field                  | Type   | Allowed Values                                                           |
|------------------------|--------|--------------------------------------------------------------------------|
| `family`               | string | Any valid font name, e.g. `"Roboto"`                                    |
| `size`                 | number | Font size in pixels, e.g. `48`, `78`, `85`, `87`, `100`, `124`          |
| `color`                | string | Hex color (`"#000000"`, `"#ff0000"`) **OR** CSS linear-gradient string   |
| `style`                | string | `"normal"` \| `"italic"`                                                |
| `weight`               | string | `"normal"` \| `"bold"` \| `"100"` through `"900"` (string numeric)      |
| `decoration`           | string | `"none"` \| `"underline"` \| `"line-through"`                           |
| `alignment`            | string | `"left"` \| `"right"` \| `"center"` \| `"justify"`                      |
| `verticalAlign`        | string | `"top"` \| `"middle"` \| `"bottom"`                                     |
| `shadow`               | object | Text shadow configuration (see §5.2.1)                                  |
| `stroke`               | object | Text stroke/outline configuration (see §5.2.2)                          |
| `colorAnimationSpeed`  | number | `0` = static, `>0` = animated gradient speed (seconds per cycle)         |
| `colorAnimationType`   | string | `"pingpong"` (gradient animates back and forth)                          |

#### Color — Gradient Syntax

When `color` is a gradient, use standard CSS `linear-gradient()` syntax:

```
"linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%)"
"linear-gradient(135deg, #7b4397 0%, #dc2430 100%)"
```

Gradient colors **can be animated** when `colorAnimationSpeed > 0`.

#### 5.2.1 Shadow Object

```json
{
  "enabled": false,
  "color": "#000000",
  "offsetX": 2,
  "offsetY": 2,
  "blur": 4
}
```

| Field     | Type    | Description                                   |
|-----------|---------|-----------------------------------------------|
| `enabled` | boolean | Whether the shadow is rendered                |
| `color`   | string  | Shadow color (hex)                            |
| `offsetX` | number  | Horizontal shadow offset in pixels            |
| `offsetY` | number  | Vertical shadow offset in pixels              |
| `blur`    | number  | Shadow blur radius in pixels                  |

#### 5.2.2 Stroke Object

```json
{
  "enabled": false,
  "color": "#000000",
  "width": 1
}
```

| Field     | Type    | Description                                   |
|-----------|---------|-----------------------------------------------|
| `enabled` | boolean | Whether the text outline/stroke is rendered   |
| `color`   | string  | Stroke color (hex)                            |
| `width`   | number  | Stroke width in pixels                        |

### 5.3 Background Image Object (Text Fill)

Fills the text glyphs with an image, optionally animated:

```json
{
  "url": "",
  "direction": "none",
  "speed": 0
}
```

| Field       | Type   | Allowed Values                                                  |
|-------------|--------|-----------------------------------------------------------------|
| `url`       | string | Relative path to asset (e.g. `"assets/stars.jpg"`), or `""` for none |
| `direction` | string | `"none"` \| `"right"` \| `"left"` \| `"up"` \| `"down"`        |
| `speed`     | number | `0` = static, `>0` = scroll speed (pixels per second or factor)|

> When `url` is empty and `direction` is `"none"`, no background image is applied.
> When `url` is set and `direction` is not `"none"`, the image scrolls continuously inside the text.

---

## 6. Image Element (`type: "image"`)

### 6.1 Properties

```json
{
  "font": { ... },
  "url": "assets/stars.jpg",
  "aspectRatio": 1.3953488372093024,
  "objectFit": "cover",
  "crop": null,
  "clipShape": "none",
  "shapeBorderWidth": 0,
  "shapeBorderColor": "#000000",
  "shapeScale": 100,
  "fit": "fill",
  "borderRadius": 0
}
```

| Field              | Type          | Allowed Values / Description                                          |
|--------------------|---------------|-----------------------------------------------------------------------|
| `font`             | object        | Inherited font object (§5.2) — present but unused for image rendering |
| `url`              | string        | Relative path to the image asset                                      |
| `aspectRatio`      | number        | Original image aspect ratio (width / height)                          |
| `objectFit`        | string        | `"cover"` \| `"contain"` \| `"fill"`                                  |
| `crop`             | object \| null| Crop region object, or `null` for no crop                             |
| `clipShape`        | string        | `"none"` \| `"circle"` \| `"rectangle"` \| `"triangle"`              |
| `shapeBorderWidth` | number        | Border width in pixels around the clip shape (`0` = no border)        |
| `shapeBorderColor` | string        | Border color (hex)                                                    |
| `shapeScale`       | number        | Scale percentage of the clip shape (`100` = full size)                |
| `fit`              | string        | `"fill"` — how the image fits within the clip shape                   |
| `borderRadius`     | number        | Border radius in pixels (only for `clipShape: "rectangle"`)          |

> **Notes:**
> - `clipShape: "none"` renders the image as a plain rectangle.
> - `clipShape: "circle"` clips the image into a circular mask.
> - `clipShape: "rectangle"` with `borderRadius > 0` creates rounded corners.
> - `fit` and `borderRadius` only appear when `clipShape` is not `"none"`.

---

## 7. Shape Element (`type: "shape"`)

### 7.1 Properties

```json
{
  "font": { ... },
  "shapeType": "rectangle",
  "fillColor": "#2196F3",
  "strokeColor": "#000000",
  "strokeWidth": 2,
  "fillColorAnimationSpeed": 0
}
```

| Field                      | Type   | Allowed Values / Description                                     |
|----------------------------|--------|------------------------------------------------------------------|
| `font`                     | object | Inherited font object (§5.2) — present but unused for shapes    |
| `shapeType`                | string | `"rectangle"` \| `"circle"` \| `"triangle"` \| `"line"`         |
| `fillColor`                | string | Hex color (`"#2196F3"`) **OR** CSS `linear-gradient()` string   |
| `strokeColor`              | string | Stroke/border color (hex)                                        |
| `strokeWidth`              | number | Stroke width in pixels                                           |
| `fillColorAnimationSpeed`  | number | `0` = static, `>0` = animated gradient speed (optional field)    |

#### Fill Color — Gradient Syntax

Shapes support the same gradient syntax as text colors:

```
"linear-gradient(135deg, #ff512f 0%, #f09819 100%)"
"linear-gradient(135deg, #7b4397 0%, #dc2430 100%)"
```

> **Note:** `fillColorAnimationSpeed` is only present/relevant when `fillColor` is a gradient.

---

## 8. ID Generation Rules

All IDs follow a consistent pattern:

| Entity       | Pattern                                      | Example                                    |
|--------------|----------------------------------------------|--------------------------------------------|
| Presentation | `presentation_{unixMs}_{9charId}`            | `presentation_1772559757416_kwnbysk58`     |
| Slide        | `slide_{unixMs}_{9charId}`                   | `slide_1772559757416_fkf2fsb1c`            |
| Element      | `element_{unixMs}_{9charId}`                 | `element_1772559761123_qq9q1th1u`          |
| Thumbnail    | `thumb_{unixMs}`                             | `thumb_1772559906631`                      |

- `{unixMs}` = Unix timestamp in milliseconds
- `{9charId}` = 9-character lowercase alphanumeric random string

---

## 9. Feature Combination Matrix

The following combinations are confirmed valid:

### Text Features

| Feature                    | Can Combine With                                                  |
|----------------------------|-------------------------------------------------------------------|
| Alignment (h)              | Any other text feature                                            |
| Vertical alignment         | Any other text feature                                            |
| Bold weight                | Color, italic, decoration, shadow, stroke, gradient, animation    |
| Italic style               | Color, bold, decoration, shadow, stroke                           |
| Underline decoration       | Color, bold, italic, shadow, stroke                               |
| Strikethrough decoration   | Color, bold, italic, shadow, stroke                               |
| Solid color                | All features except gradient color                                |
| Gradient color             | Bold, stroke, shadow, alignment, animation                        |
| Color animation            | Gradient color only (requires `colorAnimationSpeed > 0`)          |
| Text shadow                | All other features including stroke                               |
| Text stroke                | All other features including shadow and gradient                  |
| Background image           | All text styling features                                         |
| Animated background image  | All text styling features (requires `direction` + `speed > 0`)    |
| Rotation                   | All text features (set in `position.rotation`)                    |

### Image Features

| Feature            | Can Combine With                           |
|--------------------|--------------------------------------------|
| Rotation           | Any clip shape, border                     |
| Circle clip        | Rotation, scale                            |
| Rectangle clip     | Rotation, border, borderRadius, scale      |
| Shape border       | Any clip shape (requires `clipShape` != `"none"`) |
| Border radius      | Rectangle clip shape only                  |

### Shape Features

| Feature            | Can Combine With                           |
|--------------------|--------------------------------------------|
| Solid fill         | Stroke, rotation                           |
| Gradient fill      | Stroke, rotation, fill animation           |
| Fill animation     | Gradient fill only                         |
| Rotation           | Any shape type, any fill                   |

---

## 10. Defaults & Required Fields

When creating a new element, always include ALL fields. Use these defaults:

### Default Font Object

```json
{
  "family": "Roboto",
  "size": 48,
  "color": "#000000",
  "style": "normal",
  "weight": "normal",
  "decoration": "none",
  "alignment": "left",
  "verticalAlign": "top",
  "shadow": {
    "enabled": false,
    "color": "#000000",
    "offsetX": 2,
    "offsetY": 2,
    "blur": 4
  },
  "stroke": {
    "enabled": false,
    "color": "#000000",
    "width": 1
  },
  "colorAnimationSpeed": 0,
  "colorAnimationType": "pingpong"
}
```

### Default Text Properties

```json
{
  "font": { /* default font */ },
  "text": "",
  "editable": true,
  "backgroundImage": {
    "url": "",
    "direction": "none",
    "speed": 0
  }
}
```

### Default Image Properties

```json
{
  "font": { /* default font */ },
  "url": "",
  "aspectRatio": 1,
  "objectFit": "cover",
  "crop": null,
  "clipShape": "none",
  "shapeBorderWidth": 0,
  "shapeBorderColor": "#000000",
  "shapeScale": 100
}
```

### Default Shape Properties

```json
{
  "font": { /* default font */ },
  "shapeType": "rectangle",
  "fillColor": "#2196F3",
  "strokeColor": "#000000",
  "strokeWidth": 2
}
```

### Default Slide

```json
{
  "id": "slide_{unixMs}_{9charId}",
  "title": "",
  "background": "#ffffff",
  "backgroundAnimationSpeed": 0,
  "backgroundAnimationType": "pingpong",
  "visible": true,
  "shellId": null,
  "shellMode": "above",
  "autoPlay": false,
  "autoPlayDuration": 5,
  "thumbnailId": "thumb_{unixMs}",
  "elements": [],
  "animationSequence": []
}
```

---

## 11. Validation Rules

1. **All IDs must be unique** across the entire presentation.
2. **`currentSlideIndex`** must be `>= 0` and `< slides.length`.
3. **`position.rotation`** must be `0`–`359` (integer degrees).
4. **`position.width`** and **`position.height`** must be `> 0`.
5. **`font.size`** must be `> 0`.
6. **Hex colors** must match `#RRGGBB` format (6-digit lowercase or uppercase).
7. **Gradients** must be valid CSS `linear-gradient()` strings with at least 2 color stops.
8. **`colorAnimationSpeed`** only has effect when `color` is a gradient.
9. **`fillColorAnimationSpeed`** (shapes) only has effect when `fillColor` is a gradient.
10. **`backgroundImage.speed`** only has effect when `backgroundImage.direction` is not `"none"`.
11. **`backgroundImage.direction`** only has effect when `backgroundImage.url` is not empty.
12. **`borderRadius`** only applies when `clipShape` is `"rectangle"`.
13. **`shapeBorderWidth`** only renders when `clipShape` is not `"none"`.
14. **`font`** object must always be present on ALL element types, even if not used for rendering.
15. **Asset URLs** are relative paths from the presentation file location.
16. **`shells`** and **`defaultShellId`** are top-level fields that must always be present.
17. **`animationSequence`** must always be present on slides (can be empty array).
18. **`children`** must always be present on elements (can be empty array).
19. **`inEffect`** and **`outEffect`** can be `null` or an animation effect object.
