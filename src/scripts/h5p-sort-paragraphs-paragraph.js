// Import required classes
import Button from './h5p-sort-paragraphs-button';
import Util from './h5p-sort-paragraphs-util';

/** Class representing the content */
export default class SortParagraphsParagraph {
  /**
   * @constructor
   * @param {object} params Parameters.
   * @param {string} params.text Paragraph text.
   * @param {object} params.l10n Titles for move buttons.
   * @param {object} params.options Options.
   * @param {object} params.options.addButtonsForMovement If true, add buttons.
   * @param {object} callbacks Callback functions.
   * @param {function} [callbacks.onMoveUp] Callback button move up.
   * @param {function} [callbacks.onMoveDown] Callback button move down.
   * @param {function} [callbacks.onFocusOut] Callback paragraph loses focus.
   * @param {function} [callbacks.onMouseUp] Callback mouse button up.
   * @param {function} [callbacks.onMouseDown] Callback mouse button down.
   * @param {function} [callbacks.onDragStart] Callback drag start.
   * @param {function} [callbacks.onDragEnter] Callback drag enter.
   * @param {function} [callbacks.onDragLeave] Callback drag leave.
   * @param {function} [callbacks.onDragEnd] Callback drag end.
   * @param {function} [callbacks.onKeyboardUp] Callback keyboard up.
   * @param {function} [callbacks.onKeyboardDown] Callback keyboard down.
   * @param {function} [callbacks.onKeyboardSelect] Callback keyboard select.
   * @param {function} [callbacks.onKeyboardCancel] Callback keyboard cancel.
   */
  constructor(params, callbacks) {
    this.params = params;

    this.callbacks = Util.extend({
      onMoveUp: () => {}, // Button up
      onMoveDown: () => {}, // Button down
      onFocusOut: () => {}, // Paragraph lost focus
      onMouseDown: () => {}, // Select with mouse
      onMouseUp: () => {}, // Select with mouse
      onDragStart: () => {}, // Drag start
      onDragEnter: () => {}, // Drag entered other paragraph
      onDragLeave: () => {}, // Drag left other paragraph
      onDragEnd: () => {}, // Drag end
      onKeyboardUp: () => {}, // Keyboard up
      onKeyboardDown: () => {}, // Keyboard down
      onKeyboardSelect: () => {}, // Select with keyboard
      onKeyboardCancel: () => {} // Cancel with keyboard
    }, callbacks);

    // Selected state
    this.selected = false;

    // Shown state
    this.shown = true;

    // Buttons
    this.buttons = [];

    // Build content
    this.content = this.buildParagraph(this.params.text, this.params.l10n);

    // Placeholder to show when dragging
    this.placeholder = document.createElement('div');
    this.placeholder.classList.add('h5p-sort-paragraphs-paragraph-placeholder');

    // These listeners prevent Firefox from showing draggable animation
    this.placeholder.addEventListener('dragover', event => {
      event.preventDefault();
    });
    this.placeholder.addEventListener('drop', event => {
      event.preventDefault();
    });
  }

  /**
   * Return the DOM for this class.
   * @return {HTMLElement} DOM for this class.
   */
  getDOM() {
    return this.content;
  }

  /**
   * Build Paragraph.
   */
  buildParagraph() {
    const paragraph = document.createElement('div');
    paragraph.classList.add('h5p-sort-paragraphs-paragraph');
    paragraph.setAttribute('role', 'listitem');
    paragraph.setAttribute('draggable', true);

    // Container for paragraph text
    this.containerText = this.buildDIVContainer({
      classText: 'h5p-sort-paragraphs-paragraph-container',
      innerHTML: this.params.text
    });
    paragraph.appendChild(this.containerText);

    // Left container for information
    const containerLeft = this.buildDIVContainer({
      classText: 'h5p-sort-paragraphs-paragraph-button-container',
      attributes: {
        'aria-hidden': 'true'
      }
    });
    paragraph.appendChild(containerLeft);

    if (this.params?.options?.addButtonsForMovement) {
      this.buttons['up'] = this.buildButtonUp();
      containerLeft.appendChild(this.buttons['up'].getDOM());
    }

    // Right container for information
    const containerRight = this.buildDIVContainer({
      classText: 'h5p-sort-paragraphs-paragraph-button-container',
      attributes: {
        'aria-hidden': 'true'
      }
    });
    paragraph.appendChild(containerRight);

    // Container for correct/wrong markers
    this.containerCorrections = this.buildDIVContainer({
      classText: 'h5p-sort-paragraphs-paragraph-corrections'
    });
    containerRight.appendChild(this.containerCorrections);

    if (this.params?.options?.addButtonsForMovement) {
      this.buttons['down'] = this.buildButtonDown();
      containerRight.appendChild(this.buttons['down'].getDOM());
    }

    // H5P Question score explanations
    this.scoreExplanations = this.buildDIVContainer({
      classText: 'h5p-sort-paragraphs-paragraph-score-explanations'
    });
    containerRight.appendChild(this.scoreExplanations);

    // Handlers
    this.addKeyboardHandlers(paragraph);
    this.addDragHandlers(paragraph);

    return paragraph;
  }

  /**
   * Build general container for elements.
   * @param {object} [params={}] Parameters.
   * @param {string} [params.classText] Classes for classList.
   * @param {string} [params.innerHTML] Inner HTML.
   * @return {HTMLElement} Container.
   */
  buildDIVContainer(params = {}) {
    const container = document.createElement('div');
    if (params.classText) {
      container.classList.add(params.classText);
    }
    if (params.innerHTML) {
      container.innerHTML = params.innerHTML;
    }
    if (params.attributes) {
      for (let value in params.attributes) {
        container.setAttribute(value, params.attributes[value]);
      }
    }

    return container;
  }

  /**
   * Build button for moving up.
   * @return {Button} Button for moving up.
   */
  buildButtonUp() {
    return new Button(
      {
        a11y: {
          active: this.params.l10n.up,
          disabled: this.params.l10n.disabled
        },
        classes: ['h5p-sort-paragraphs-button', 'h5p-sort-paragraphs-paragraph-button-up']
      },
      {
        onClick: (() => {
          this.callbacks.onMoveUp(this.content);
        })
      }
    );
  }

  /**
   * Build button for moving down.
   * @return {Button} Button for moving down.
   */
  buildButtonDown() {
    return new Button(
      {
        a11y: {
          active: this.params.l10n.down,
          disabled: this.params.l10n.disabled
        },
        classes: ['h5p-sort-paragraphs-button', 'h5p-sort-paragraphs-paragraph-button-down']
      },
      {
        onClick: (() => {
          this.callbacks.onMoveDown(this.content);
        })
      }
    );
  }

  /**
   * Add keyboard handlers to paragraph.
   * @param {HTMLElement} paragraph Paragraph.
   */
  addKeyboardHandlers(paragraph) {
    paragraph.addEventListener('keydown', event => {
      switch (event.code) {
        case 'ArrowUp': // Up
          event.preventDefault(); // No scrolling

          if (event.currentTarget === event.currentTarget.parentNode.firstChild) {
            return; // Skip, already top paragraph
          }

          this.callbacks.onKeyboardUp(event.currentTarget);
          break;

        case 'ArrowDown': // Down
          event.preventDefault(); // No scrolling

          if (event.currentTarget === event.currentTarget.parentNode.lastChild) {
            return; // Skip, already bottom paragraph
          }

          this.callbacks.onKeyboardDown(event.currentTarget);
          break;

        case 'Enter': // Return
          // Intentional fallthrough
        case 'Space': // Space
          // Toggle state
          if (this.disabled) {
            return;
          }

          this.callbacks.onKeyboardSelect(event.currentTarget);
          break;

        case 'Escape': // Escape
          if (this.disabled) {
            return;
          }

          this.callbacks.onKeyboardCancel(event.currentTarget);
          break;

        // TODO: Add handling for PageUp and PageDown
      }
    });
  }

  /**
   * Add drag handlers to paragraph.
   * @param {HTMLElement} paragraph Paragraph.
   */
  addDragHandlers(paragraph) {
    // Mouse down. Prevent dragging when using buttons.
    paragraph.addEventListener('mousedown', event => {
      this.handleMouseUpDown(event, 'onMouseDown');
    });

    // Mouse up. Allow dragging after using buttons.
    paragraph.addEventListener('mouseup', event => {
      this.handleMouseUpDown(event, 'onMouseUp');
    });

    // Focus out
    paragraph.addEventListener('focusout', event => {
      this.toggleEffect('selected', false);

      this.callbacks.onFocusOut(event.currentTarget);
    });

    // Drag start
    paragraph.addEventListener('dragstart', event => {
      this.handleDragStart(event);
    });

    // Drag over
    paragraph.addEventListener('dragover', event => {
      this.handleDragOver(event);
    });

    // Drag enter
    paragraph.addEventListener('dragenter', event => {
      this.handleDragEnter(event);
    });

    // Drag leave
    paragraph.addEventListener('dragleave', event => {
      this.handleDragLeave(event);
    });

    // Drag end
    paragraph.addEventListener('dragend', (event) => {
      this.handleDragEnd(event);
    });

    // Prevent visual dragging mode on mobile
    paragraph.addEventListener('touchstart', (event) => {
      if (!event.cancelable || this.disabled) {
        return;
      }

      paragraph.setAttribute('draggable', false);
    });

    // Allow dragging again, device might allow mouse and touch
    paragraph.addEventListener('touchend', () => {
      if (this.disabled) {
        return;
      }

      paragraph.setAttribute('draggable', true);
    });
  }

  /**
   * Show placeholder. Draggable must be visible, or width/height = 0
   */
  showPlaceholder() {
    if (!this.isShown()) {
      return;
    }

    this.placeholder.style.width = `${this.content.offsetWidth}px`;
    this.placeholder.style.height = `${this.content.offsetHeight}px`;

    this.attachPlaceholder();
  }

  /**
   * Attach placeholder.
   */
  attachPlaceholder() {
    this.content.parentNode.insertBefore(this.placeholder, this.content.nextSibling);
  }

  /**
   * Hide placeholder.
   */
  hidePlaceholder() {
    this.placeholder.parentNode.removeChild(this.placeholder);
  }

  /**
   * Show paragraph.
   */
  show() {
    this.content.classList.remove('h5p-sort-paragraphs-no-display');
    this.shown = true;
  }

  /**
   * Hide paragraph.
   */
  hide() {
    this.content.classList.add('h5p-sort-paragraphs-no-display');
    this.shown = false;
  }

  /**
   * Determine whether paragraph is shown.
   * @return {boolean} True, if paragraph is shown.
   */
  isShown() {
    return this.shown;
  }

  /**
   * Determine whether paragraph is selected.
   * @return {boolean} True, if paragraph is selected.
   */
  isSelected() {
    return this.selected;
  }

  /**
   * Select paragraph.
   */
  select() {
    this.selected = true;
    this.toggleEffect('selected', true);
  }

  /**
   * Unselect paragraph.
   */
  unselect() {
    this.selected = false;
    this.toggleEffect('selected', false);
  }

  /**
   * Enable paragraph. Paragraph movable via dragging or buttons.
   */
  enable() {
    this.content.setAttribute('draggable', true);
    this.toggleEffect('disabled', false);

    for (let id in this.buttons) {
      this.buttons[id].enable();
    }

    this.disabled = false;
  }

  /**
   * Disable paragraph. Paragraph not movable via dragging or buttons.
   */
  disable() {
    this.disabled = true;

    this.content.setAttribute('draggable', false);
    this.toggleEffect('disabled', true);

    for (let id in this.buttons) {
      this.buttons[id].disable();
    }
  }

  /**
   * Focus paragraph.
   */
  focus() {
    this.content.focus();
  }

  /**
   * Get paragraph's HTML text.
   * @return {string} HTML text.
   */
  getText() {
    return this.containerText.innerHTML;
  }

  /**
   * Set HTML text.
   * @param {string} text HTML text.
   */
  setText(text) {
    if (typeof text !== 'string') {
      return;
    }

    this.containerText.innerHTML = text;
  }

  /**
   * Set tab index.
   * @param {number} tabIndex TabIndex.
   */
  setTabIndex(tabIndex) {
    if (typeof tabIndex !== 'number') {
      return;
    }

    this.content.setAttribute('tabIndex', tabIndex);
  }

  /**
   * Reset.
   */
  reset() {
    this.content.classList.remove('disabled');
    this.content.classList.remove('solution');
    this.unselect();
  }

  /**
   * Show buttons container.
   */
  showButtons() {
    for (let button in this.buttons) {
      this.buttons[button].show();
    }
  }

  /**
   * Hide buttons container.
   */
  hideButtons() {
    for (let button in this.buttons) {
      this.buttons[button].hide();
    }
  }

  /**
   * Toggle button enabled state.
   * @param {string|number} id Id of button.
   * @param {boolean} enabled If true, set button enabled, else disabled.
   */
  toggleButton(id, enabled) {
    if (!id || !this.buttons[id] || typeof enabled !== 'boolean') {
      return;
    }

    if (enabled) {
      this.buttons[id].enable();
    }
    else {
      this.buttons[id].disable();
    }
  }

  /**
   * Toggle CSS class named after an effect.
   * @param {string} effectName Effect name.
   * @param {boolean} enabled If true, effect will be set, else unset.
   */
  toggleEffect(effectName, enabled) {
    const effects = ['over', 'ghosted', 'disabled', 'selected', 'correct', 'wrong', 'solution'];
    if (typeof enabled !== 'boolean' || effects.indexOf(effectName) === -1) {
      return;
    }

    if (enabled) {
      this.content.classList.add(`h5p-sort-paragraphs-${effectName}`);
    }
    else {
      this.content.classList.remove(`h5p-sort-paragraphs-${effectName}`);
    }
  }

  /**
   * Translate by offset with animation.
   * @param {object} offset Offset.
   * @param {number} [offset.x] X offset.
   * @param {number} [offset.y] Y offset.
   */
  translate(offset = {}) {
    if (typeof offset.x === 'number' || typeof offset.y === 'number') {
      this.content.classList.add('animate-translation');
      setTimeout(() => {
        this.content.style.transform = `translate(${offset.x || 0}px, ${offset.y || 0}px)`;
      }, 0);
    }
    else {
      this.content.classList.remove('animate-translation');
      this.content.style.transform = '';
    }
  }

  /**
   * Set aria label.
   * @param {string} ariaLabel Aria label.
   */
  setAriaLabel(ariaLabel) {
    /*
     * It may be better to use aria-describedby technically, but the
     * description is read after the label, and reading a potentially long
     * paragraph first and only then the position/description feels bad
     */
    this.content.setAttribute('aria-label', ariaLabel);
  }

  /**
   * Add H5P Question score explanation.
   * @param {HTMLElement} scoreExplanation H5P Question score explanation.
   */
  showScoreExplanation(scoreExplanation) {
    this.scoreExplanations.appendChild(scoreExplanation);
  }

  /**
   * Remove H5P Question score explanation.
   */
  hideScoreExplanation() {
    this.scoreExplanations.innerHTML = '';
  }

  /**
   * Handle mouse button up or down.
   * @param {Event} event Mouse event.
   * @param {string} callbackName Callback name.
   */
  handleMouseUpDown(event, callbackName) {
    if (this.disabled) {
      return;
    }

    // Used in dragstart for Firefox workaround
    this.pointerPosition = {
      x: event.clientX,
      y: event.clientY
    };

    if (
      this.params.options.addButtonsForMovement &&
      (
        event.target === this.buttons['up'].getDOM() ||
        event.target === this.buttons['down'].getDOM()
      )
    ) {
      this.content.setAttribute('draggable', true);
    }
    else {
      this.callbacks[callbackName](event.currentTarget);
    }
  }

  /**
   * Handle drag start.
   * @param {Event} event Event.
   */
  handleDragStart(event) {
    if (this.disabled) {
      return;
    }

    this.hideButtons();

    // Will hide draggable as well without timeout
    setTimeout(() => {
      this.showPlaceholder();
      this.hide();
    }, 0);

    this.toggleEffect('over', true);
    event.dataTransfer.effectAllowed = 'move';

    // Workaround for Firefox that may scale the draggable down otherwise
    event.dataTransfer.setDragImage(
      event.currentTarget,
      this.pointerPosition.x - event.currentTarget.offsetLeft,
      this.pointerPosition.y - event.currentTarget.offsetTop
    );

    this.callbacks.onDragStart(event.currentTarget);
  }

  /**
   * Handle drag over.
   * @param {Event} event Event.
   */
  handleDragOver(event) {
    if (this.disabled) {
      return;
    }

    event.preventDefault();
  }

  /**
   * Handle drag enter.
   * @param {Event} event Event.
   */
  handleDragEnter(event) {
    if (this.disabled) {
      return;
    }

    this.callbacks.onDragEnter(event.currentTarget);
  }

  /**
   * Handle drag leave.
   * @param {Event} event Event.
   */
  handleDragLeave(event) {
    if (this.disabled) {
      return;
    }

    if (this.content !== event.target || this.content.contains(event.fromElement)) {
      return;
    }

    this.callbacks.onDragLeave(event.currentTarget);
  }

  /**
   * Handle drag end.
   * @param {Event} event Event.
   */
  handleDragEnd(event) {
    if (this.disabled) {
      return;
    }

    this.hidePlaceholder();
    this.show();

    this.showButtons();

    this.toggleEffect('over', false);

    this.callbacks.onDragEnd(event.currentTarget);
  }
}
