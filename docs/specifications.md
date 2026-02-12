# WOW3 - Specifications

## Introduction

WOW3 is a presentation software similar to Apple Keynote.
It is designed to be simple and easy to use, with a focus on creating beautiful presentations quickly.

## Features

- Create and edit presentations
- Add and edit slides
- Add and edit text inside slides
- Add and edit images inside slides
- Add and edit videos inside slides
- Add and edit audio inside slides
- Add and edit lists inside slides
- Add and edit links inside slides
- Add and edit animations inside slides
- Add and edit transitions between slides

## User Interface

The user interface is divided into three main sections:

1. The left sidebar, which contains the list of slides in the presentation
2. The main area, which contains the currently selected slide
3. The right sidebar, which contains the properties of the currently selected slide or element
4. The top menu bar, which contains the main menu and toolbar
5. The bottom status bar, which contains the current slide number and total number of slides

### The left sidebar

The left sidebar contains the list of slides in the presentation. Each slide is represented by a thumbnail image.

- The user can click on a slide to select it and edit it in the main area.
- The user can also drag and drop slides to reorder them.
- The user can right-click on a slide to delete it or duplicate it.
- The user can also add a new slide by clicking on the "+" button at the top of the sidebar.

### The main area

The main area contains the currently selected slide. The user can edit the slide by clicking on it and using the properties in the right sidebar.

- The user can add text, images, videos, audio, lists, links, animations, and transitions to the slide by using the toolbar at the top of the main area.
- The user can also use the keyboard shortcuts to quickly add and edit elements.
- The user can use the mouse to drag and drop elements to reposition them on the slide.
- The user can use the mouse to resize elements by dragging the corners or edges.
  NOTE: while resizing Image and Video elements, if you click the CTRL key, the aspect ratio will be maintained (taken from the image width and height)
- The user can use the mouse to rotate elements by dragging the rotation handle.
- While dragging elements, the element box should be highlighted to indicate that it is being moved.
- While dragging elements, the page should show positioning lines of other elements to help the user align the element with other elements.

#### Notes on Image and Video elements

- The image should always be as big as the container.
- If the container does not respect original image Aspect Ratio, it is not important, the image always cover all the container

### Page Elements Tree

The Page Elements Tree is a feature that allows the user to see all the elements on the current slide in a hierarchical view.
It is located at the right sidebar of the main area and it is always visible.
The tree is organized in a way that shows the parent-child relationship between elements, the tree can only have 2 levels of depth: an element can only have children, but not grandchildren.
On the left of the element name, there are two small buttons to define the "in" and "out" effects of the element.

- The "in" effect is the animation that will be played when the element appears on the slide.
- The "out" effect is the animation that will be played when the element disappears from the slide.
  "in" and "out" effects are optional. If they are defined, the "in" animation will be triggered by the mouse click, and the "out" animation will be triggered by the mouse click again.
  The "out" animation can also start the disappear effect of other elements.
- The "in" and "out" effects can be defined by clicking on the buttons next to the element name in the Page Elements tree, inside a modal window.
- In "Play mode", elements are shown in the order they are added to the Page Elements tree.
- An element can be added inside another element, such as a text box inside a shape, in this case the element will be added to the Page Elements tree as a child of the parent element.
- Elements embedded inside other elements will be shown in the Page Elements tree as a child of the parent element, and in "Play Mode" will appear together.

### The Right sidebar

The right sidebar contains the properties of the currently selected slide or element. The properties are divided into three tabs:

1. The "Slide" tab, which contains the properties of the slide itself
2. The "Element" tab, which contains the properties of the currently selected element
3. The "Animation" tab, which contains the properties of the currently selected animation of the element

Depending on the selected element, the properties will change.

- For text: font size, font color, font family, font style, font weight, text alignment, text shadow.
- For image: image size, image URL.
- For video: video size, video URL.
- For audio: audio size, audio URL.

## Data Types

### Presentation

```typescript
interface Presentation {
  id: string;
  title: string;
  slides: Slide[];
}

interface Slide {
  id: string;
  title: string;
  elements: Element[];
}

interface Element {
  id: string;
  type: ElementType;
  properties: ElementProperties;
  position: Position;
}

enum ElementType {
  TEXT = "text",
  IMAGE = "image",
  VIDEO = "video",
  AUDIO = "audio",
  LIST = "list",
  LINK = "link",
  SHAPE = "shape",
}

interface FontProperties {
  family: string;
  size: number;
  color: string;
  style: "normal" | "italic" | "oblique";
  weight: "normal" | "bold" | "bolder" | "lighter";
  decoration: "none" | "underline" | "line-through" | "overline";
  alignment: "left" | "center" | "right" | "justify";
}

interface ElementProperties {
  text?: string;
  url?: string;
  listItems?: string[];
  font: FontProperties;
}

interface Position {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

enum AnimationTrigger {
  CLICK = "click",
  AUTO = "auto",
}

// Elements that must be animated when another element is animated
interface AnimationOther {
  id: string; // ID of the element to be animated
  mode: "in" | "out"; // Animation mode
}

const FADE_IN = 1;
const FADE_OUT = 2;
const SLIDE_IN = 4;
const SLIDE_OUT = 8;
const ZOOM_IN = 16;
const ZOOM_OUT = 32;

interface Animation {
  type: number; // A combination of the above constants
  duration: number; // Duration in milliseconds
  trigger: AnimationTrigger; // Trigger type
}

interface ElementsTree {
  id: string;
  name: string;
  children: ElementsTree[];
  inEffect?: Animation;
  outEffect?: Animation;
  level: number; // 0 for root, 1 for children
}
```
