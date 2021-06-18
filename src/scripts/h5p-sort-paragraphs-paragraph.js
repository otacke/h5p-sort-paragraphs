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
   * @param {object} callbacks Callback functions.
   * @param {function} [callbacks.onMoveUp] Callback button move up.
   * @param {function} [callbacks.onMoveDown] Callback button move down.
   * @param {function} [callbacks.onFocusOut] Callback paragraph loses focus.
   * @param {function} [callbacks.onMouseUp] Callback mouse button up.
   * @param {function} [callbacks.onMouseDown] Callback mouse button down.
   * @param {function} [callbacks.onDragStart] Callback drag start.
   * @param {function} [callbacks.onDragOver] Callback drag over.
   * @param {function} [callbacks.onDragEnter] Callback drag enter.
   * @param {function} [callbacks.onDragLeave] Callback drag leave.
   * @param {function} [callbacks.onDragEnd] Callback drag end.
   * @param {function} [callbacks.onKeyboardUp] Callback keyboard up.
   * @param {function} [callbacks.onKeyboardDown] Callback keyboard down.
   * @param {function} [callbacks.onKeyboardSelect] Callback keyboard select.
   * @param {function} [callbacks.onKeyboardCancel] Callback keyboard cancel.
   */
  constructor(params, callbacks) {
    this.text = params.text;
    this.l10n = params.l10n;

    this.callbacks = Util.extend({
      onMoveUp: () => {}, // Button up
      onMoveDown: () => {}, // Button down
      onFocusOut: () => {}, // Paragraph lost focus
      onMouseDown: () => {}, // Select with mouse
      onMouseUp: () => {}, // Select with mouse
      onDragStart: () => {}, // Drag start
      onDragOver: () => {}, // Drag over other paragraph
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

    // Buttons
    this.buttons = [];

    // Build content
    this.content = this.buildParagraph(this.text, this.l10n);
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
    paragraph.setAttribute('role', 'option');
    paragraph.setAttribute('draggable', true);

    // Left container for information
    const containerLeft = this.buildContainerLeft();
    paragraph.appendChild(containerLeft);

    this.buttons['up'] = this.buildButtonUp();
    containerLeft.appendChild(this.buttons['up'].getDOM());

    // Container for correct/wrong markers
    this.containerCorrections = this.buildContainerCorrections();
    containerLeft.appendChild(this.containerCorrections);

    // Conatainer for paragraph text
    this.containerText = this.buildContainerText();
    paragraph.appendChild(this.containerText);

    // Right container for information
    const containerRight = this.buildContainerRight();
    paragraph.appendChild(containerRight);

    this.buttons['down'] = this.buildButtonDown();
    containerRight.appendChild(this.buttons['down'].getDOM());

    // H5P Question score explanations
    this.scoreExplanations = this.buildScoreExplanations();
    containerRight.appendChild(this.scoreExplanations);

    // Handlers
    this.addKeyboardHandlers(paragraph);
    this.addDragHandlers(paragraph);

    return paragraph;
  }

  /**
   * Build left container for additional elements.
   * @return {HTMLElement} Left container for additional elements.
   */
  buildContainerLeft() {
    const paragraphContentLeft = document.createElement('div');
    paragraphContentLeft.classList.add('h5p-sort-paragraphs-paragraph-container-left');

    return paragraphContentLeft;
  }

  /**
   * Build button for moving up.
   * @return {Button} Button for moving up.
   */
  buildButtonUp() {
    return new Button(
      {
        a11y: {
          active: this.l10n.up,
          disabled: this.l10n.disabled
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
   * Build container for corrections.
   * @return {HTMLElement} Container for corrections.
   */
  buildContainerCorrections() {
    const corrections = document.createElement('div');
    corrections.classList.add('h5p-sort-paragraphs-paragraph-corrections');

    return corrections;
  }

  /**
   * Build text container.
   * @return {HTMLElement} Text container.
   */
  buildContainerText() {
    const content = document.createElement('div');
    content.classList.add('h5p-sort-paragraphs-paragraph-container');
    content.innerHTML = this.text;

    return content;
  }

  /**
   * Build right container for additional elements.
   * @return {HTMLElement} Right container for additional elements.
   */
  buildContainerRight() {
    const contentRight = document.createElement('div');
    contentRight.classList.add('h5p-sort-paragraphs-paragraph-container-right');

    return contentRight;
  }

  /**
   * Build button for moving down.
   * @return {Button} Button for moving down.
   */
  buildButtonDown() {
    return new Button(
      {
        a11y: {
          active: this.l10n.down,
          disabled: this.l10n.disabled
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
   * Build H5P Question score explanations holder.
   * @return {HTMLElement} H5P Question score explanations holder.
   */
  buildScoreExplanations() {
    const explanations = document.createElement('div');
    explanations.classList.add('h5p-sort-paragraphs-paragraph-score-explanations');

    return explanations;
  }

  /**
   * Add keyboard handlers to paragraph.
   * @param {HTMLElement} paragraph Paragraph.
   */
  addKeyboardHandlers(paragraph) {
    paragraph.addEventListener('keydown', event => {
      switch (event.keyCode) {
        case 38: // Up
          event.preventDefault(); // No scrolling

          if (event.currentTarget === event.currentTarget.parentNode.firstChild) {
            return; // Skip, already top paragraph
          }

          this.callbacks.onKeyboardUp(event.currentTarget);
          break;

        case 40: // Down
          event.preventDefault(); // No scrolling

          if (event.currentTarget === event.currentTarget.parentNode.lastChild) {
            return; // Skip, already bottom paragraph
          }

          this.callbacks.onKeyboardDown(event.currentTarget);
          break;

        case 13: // Return
          // Intentional fallthrough
        case 32: // Space
          // Toggle state
          if (this.disabled) {
            return;
          }

          this.callbacks.onKeyboardSelect(event.currentTarget);
          break;

        case 27: // Escape
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
      if (this.disabled) {
        return;
      }

      if (
        event.target === this.buttons['up'].getDOM() ||
        event.target === this.buttons['down'].getDOM()
      ) {
        this.content.setAttribute('draggable', false);
      }
      else {
        this.callbacks.onMouseDown(event.currentTarget);
      }
    });

    // Mouse up. Allow dragging after using buttons.
    paragraph.addEventListener('mouseup', event => {
      if (this.disabled) {
        return;
      }

      if (
        event.target === this.buttons['up'].getDOM() ||
        event.target === this.buttons['down'].getDOM()
      ) {
        this.content.setAttribute('draggable', true);
      }
      else {
        this.callbacks.onMouseUp(event.currentTarget);
      }
    });

    // Focus out
    paragraph.addEventListener('focusout', event => {
      this.toggleEffect('selected', false);

      this.callbacks.onFocusOut(event.currentTarget);
    });

    // Drag start
    paragraph.addEventListener('dragstart', event => {
      if (this.disabled) {
        return;
      }

      this.toggleEffect('over', true);
      this.toggleEffect('ghosted', true);
      event.dataTransfer.effectAllowed = 'move';

      this.callbacks.onDragStart(event.currentTarget);
    });

    // Drag over
    paragraph.addEventListener('dragover', event => {
      event.preventDefault();

      this.callbacks.onDragOver(event.currentTarget);
    });

    // Drag enter
    paragraph.addEventListener('dragenter', event => {

      this.callbacks.onDragEnter(event.currentTarget);
    });

    // Drag leave
    paragraph.addEventListener('dragleave', event => {
      if (paragraph !== event.target || paragraph.contains(event.fromElement)) {
        return;
      }

      this.callbacks.onDragLeave(event.currentTarget);
    });

    // Drag end
    paragraph.addEventListener('dragend', (event) => {
      this.toggleEffect('over', false);
      this.toggleEffect('ghosted', false);

      this.callbacks.onDragEnd(event.currentTarget);
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
   * Set aria label.
   * @param {string} ariaLabel Aria label.
   */
  setAriaLabel(ariaLabel) {
    this.content.setAttribute('aria-label', ariaLabel);
  }

  /**
   * Add H5P Question score explanation.
   * @param {HTMLElement} explanation H5P Question score explanation.
   */
  showScoreExplanation(explanation) {
    this.scoreExplanations.appendChild(explanation);
  }

  /**
   * Remove H5P Question score explanation.
   */
  removeScoreExplanation() {
    this.scoreExplanations.innerHTML = '';
  }
}
