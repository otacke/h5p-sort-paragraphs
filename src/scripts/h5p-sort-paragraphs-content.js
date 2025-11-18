// Import required classes
import Util from './h5p-sort-paragraphs-util.js';
import SortParagraphsParagraph from './h5p-sort-paragraphs-paragraph.js';
import SortParagraphsSeparator from './h5p-sort-paragraphs-separator.js';

/** @constant {number} SECOND_LAST_INDEX_OFFSET Offset for second last item. */
const SECOND_LAST_INDEX_OFFSET = 2;

/** @constant {number} FOCUS_DELAY_SMALL Delay for small focus changes. */
const FOCUS_DELAY_SMALL = 100;

/** @constant {number} FOCUS_DELAY_LARGE Delay for large focus changes. */
const FOCUS_DELAY_LARGE = 550;

/** Class representing the content */
export default class SortParagraphsContent {
  /**
   * @class
   * @param {object} params Parameters.
   * @param {object} [callbacks] Callbacks.
   */
  constructor(params = {}, callbacks = {}) {
    this.params = Util.extend({
      previousState: {
        viewState: 0,
      },
    }, params);

    this.callbacks = Util.extend({
      onInteracted: () => {},
      read: () => {},
    }, callbacks);

    this.content = document.createElement('div');
    this.content.classList.add('h5p-sort-paragraphs-content');

    this.draggedElement = null; // Currently dragged element
    this.answerGiven = Array.isArray(this.params.previousState?.order);
    this.enabled = true; // Enabled state of content
    this.oldOrder = null; // Old order when dragging

    this.viewStates = this.params.viewStates;
    this.setViewState(this.params.previousState?.viewState);

    // Original position of selected draggable
    this.selectedDraggable = null;

    // Register state of mouse button on draggable
    this.isMouseDownOnDraggable = false;

    this.handleSwapTransitionEnded = this.handleSwapTransitionEnded.bind(this);
    this.handleSwapSolutionEnded = this.handleSwapSolutionEnded.bind(this);

    // View/handling options
    this.options = {
      scoringMode: params.scoringMode || 'transitions',
      penalties: (typeof params.penalties !== 'boolean') ? true : params.penalties,
      duplicatesInterchangeable: params.duplicatesInterchangeable,
    };

    // ARIA label texts
    this.ariaTemplates = this.buildAriaTemplates();

    // Build n paragraphs
    this.paragraphs = params.paragraphs
      .map((paragraph) => this.buildParagraph(paragraph));

    // Build n-1 separators for transitions
    this.separators = [];
    params.paragraphs.forEach((paragraph, index) => {
      if (index === params.paragraphs.length - SECOND_LAST_INDEX_OFFSET) {
        return;
      }
      this.separators.push(new SortParagraphsSeparator());
    });

    // Build list of paragraphs
    this.list = this.buildList(this.paragraphs);
    this.content.appendChild(this.list);

    // Use previous state or shuffle paragraphs
    if (params.previousState && params.previousState.order) {
      this.reorderDraggables(params.previousState.order);
    }
    else {
      Util.shuffleDOMElements(this.paragraphs.map((paragraph) => paragraph.getDOM()));
    }

    // Reset paragraphs
    this.resetAriaLabels();
    this.resetDraggablesTabIndex();
    this.resetDraggables();
  }

  /**
   * Reorder draggables.
   * @param {number[]} newOrder New order.
   */
  reorderDraggables(newOrder) {
    let draggables;
    for (let i = 0; i < newOrder.length; i++) {
      draggables = this.getDraggables();
      const currentOrder = this.getDraggablesOrder();
      if (currentOrder[i] !== newOrder[i]) {
        Util.swapDOMElements(draggables[i], draggables[currentOrder.indexOf(newOrder[i])]);
      }
    }
  }

  /**
   * Return the DOM for this class.
   * @returns {HTMLElement} DOM for this class.
   */
  getDOM() {
    return this.content;
  }

  /**
   * Focus first draggable.
   * @param {number} [delay] Delay for focussing.
   */
  focusFirstDraggable(delay = 0) {
    window.clearTimeout(this.focusTimeout);
    this.focusTimeout = window.setTimeout(() => {
      this.list.childNodes[0].focus();
    }, delay); // Give results time to be read
  }

  /**
   * Show results.
   * @param {object} [params] Parameters.
   * @param {boolean} [params.skipExplanation] If true, skip score explanation.
   * @param {boolean} [params.skipFocus] If true, skip focus.
   */
  showResults(params = {}) {
    const results = this.computeResults();
    this.list.setAttribute('aria-label', this.params.a11y.listDescriptionCheckAnswer);

    // Hide buttons
    this.paragraphs.forEach((paragraph) => {
      paragraph.setButtonsVertical(false);
      paragraph.hideButtons();
      paragraph.disable();
    });

    if (!params.skipExplanation) {
      // Add score explanation and ARIA depending on scoring mode.
      if (this.options.scoringMode === 'positions') {
        this.showScoreExplanation(this.getDraggables().map((draggable) => this.getParagraph(draggable)), results);
        this.addScoreAria(this.getDraggables(), results);
      }
      else if (this.options.scoringMode === 'transitions') {
        this.showScoreExplanation(this.separators, results);
        this.addScoreAria(this.getDraggables(), results);
        this.setAriaLabel(this.getDraggables().pop(), { action: 'neutral' });
      }
    }

    this.resetDraggablesTabIndex();

    if (!params.skipFocus) {
      this.focusFirstDraggable(100);
    }
  }

  /**
   * Hide results.
   */
  hideResults() {
    const elements = this.paragraphs.concat(this.separators);

    elements.forEach((element) => {
      element.toggleEffect('correct', false);
      element.toggleEffect('wrong', false);
      element.setAriaLabel('');
      element.hideScoreExplanation();
    });
  }

  /**
   * Show solutions.
   * @param {object} [params] Parameters.
   * @param {boolean} [params.skipFocus] If true, skip focussing.
   */
  showSolutions(params = {}) {
    this.hideResults();

    this.list.setAttribute('aria-label', this.params.a11y.listDescriptionShowSolution);

    this.paragraphs.forEach((paragraph) => {
      paragraph.setButtonsVertical(false);
      paragraph.toggleEffect('solution', true);
    });

    this.paragraphs[this.paragraphs.length - 1].getDOM()
      .addEventListener('transitionend', this.handleSwapSolutionEnded);

    const draggables = this.getDraggables();

    // Translate to correct top offsets for each paragraph
    let startPosition = draggables[0].offsetTop;
    draggables.forEach((draggable, index) => {
      if (index > 0) {
        startPosition += this.paragraphs[index - 1].getDOM().offsetHeight +
          draggable.offsetTop - draggables[index - 1].offsetTop - draggables[index - 1].offsetHeight;
      }

      this.paragraphs[index].translate({ y: startPosition - this.paragraphs[index].getDOM().offsetTop });
    });

    if (!params.skipFocus) {
      // Focus when draggables are re-ordered
      this.focusFirstDraggable(FOCUS_DELAY_LARGE);
    }
  }

  /**
   * Handle elements at correct position in solution view.
   */
  handleSwapSolutionEnded() {
    this.paragraphs[this.paragraphs.length - 1].getDOM()
      .removeEventListener('transitionend', this.handleSwapSolutionEnded);

    // Move draggables in correct order
    this.paragraphs.forEach((paragraph, index) => {
      paragraph.translate();
      const draggables = this.getDraggables();
      const position = draggables.indexOf(paragraph.getDOM());

      if (position !== index) {
        Util.swapDOMElements(draggables[index], draggables[position]);
      }
    });

    this.resetAriaLabels();
    this.resetDraggablesTabIndex();
    this.getDraggables().forEach((draggable) => {
      this.setAriaLabel(draggable, { action: 'solution' });
    });
  }

  /**
   * Add ARIA for score explanation.
   * @param {SortParagraphsParagraph[]|SortParagraphsSeparator[]} elements Elements.
   * @param {object} results Results.
   * @param {boolean[]} results.correctAnswers True if paragraph/separator at index is correct.
   */
  addScoreAria(elements, results) {
    results.correctAnswers.forEach((answer, index) => {
      const element = elements[index];
      const showMinus = (this.options.penalties && this.options.scoringMode === 'positions');

      const ariaOptions = {
        action: (this.options.scoringMode === 'positions') ? 'resultPositions' : 'resultTransitions',
        result: (answer === true) ? this.params.a11y.correct : this.params.a11y.wrong,
        points: this.calculatePointsText(answer, showMinus),
      };

      this.setAriaLabel(element, ariaOptions);
    });
  }

  /**
   * Calculate points text for ARIA options
   * @param {boolean} answer Whether the answer is correct
   * @param {boolean} showMinus Whether to show minus points
   * @returns {string|undefined} Points text or undefined
   */
  calculatePointsText(answer, showMinus) {
    if (answer === true) {
      return this.params.a11y.point.replace('@score', 1);
    }

    if (showMinus) {
      return this.params.a11y.point.replace('@score', -1);
    }

    return undefined;
  }

  /**
   * Show H5P Question score explanation.
   * @param {SortParagraphsParagraph[]|SortParagraphsSeparator[]} elements Elements.
   * @param {object} results Results.
   * @param {boolean[]} results.correctAnswers True if paragraph/separator at index is correct.
   */
  showScoreExplanation(elements, results) {
    this.scorePoints = this.scorePoints || new H5P.Question.ScorePoints();

    results.correctAnswers.forEach((answer, index) => {
      const element = elements[index];

      if (answer === true) {
        element.toggleEffect('correct', true);
        element.showScoreExplanation(this.scorePoints.getElement(true));
      }
      else {
        element.toggleEffect('wrong', true);

        const showMinus = (this.options.penalties && this.options.scoringMode === 'positions');
        if (showMinus) {
          element.showScoreExplanation(this.scorePoints.getElement(false));
        }
      }
    });
  }

  /**
   * Compute results.
   * @returns {object} Results.
   */
  computeResults() {
    let score = 0;
    let correctAnswers;

    // Determine paragraph id at each position.
    const draggables = this.getDraggables();
    const paragraphs = this.paragraphs.map((paragraph) => paragraph.getDOM());
    const ids = draggables.map((draggable) => paragraphs.indexOf(draggable));

    if (this.options.scoringMode === 'positions') {
      correctAnswers = Util.createArray(this.paragraphs.length);

      // +1 if match, -1 if no match only if penalty is on
      score = ids.reduce((score, id, index) => {
        const match = (id === index) ||
          (this.options.duplicatesInterchangeable && draggables[index].innerText === paragraphs[index].innerText);

        correctAnswers[index] = match;

        score += (match) ? 1 : 0;
        score += (!match && this.options.penalties) ? -1 : 0;

        return score;
      }, 0);
    }
    else if (this.options.scoringMode === 'transitions') {
      correctAnswers = Util.createArray(this.paragraphs.length - 1);

      const draggablesPlain = draggables.map((draggable) => draggable.innerText);
      const paragraphsPlain = paragraphs.map((paragraph) => paragraph.innerText);

      // +1 for every correct sequence regardless of position
      for (let index = 0; index < ids.length - 1; index++) {
        const inputSequence = [draggablesPlain[index], draggablesPlain[index + 1]];

        // Determine if current plain sequence is found in solution
        const matchPlain = paragraphsPlain.reduce((result, current, index) => {
          if (result === true) {
            return true;
          }

          if (index === paragraphsPlain.length - 1) {
            return false;
          }

          return current === inputSequence[0] && paragraphsPlain[index + 1] === inputSequence[1];
        }, false);

        if ((this.options.duplicatesInterchangeable && matchPlain) || ids[index] === ids[index + 1] - 1) {
          correctAnswers[index] = true;

          score++;
        }
        else {
          correctAnswers[index] = false;
        }
      }
    }

    return {
      correctAnswers: correctAnswers,
      score: Math.max(0, score),
    };
  }

  /**
   * Build list of paragraphs.
   * @param {SortParagraphsParagraph[]} paragraphs Paragraphs.
   * @returns {HTMLElement} List of paragpraphs.
   */
  buildList(paragraphs) {
    const list = document.createElement('div');
    /*
     * Using 'application' instead of 'list' because commonly used NVDA
     * screenreader overrides arrow key usage and doesn't announce changes
     * when moving draggables with arrow keys. ChromeVox and JAWS can
     * cope with 'application' instead of 'list', too.
     */
    list.setAttribute('role', 'application');
    list.setAttribute(
      'aria-label',
      `${this.params.taskDescription} ${this.params.a11y.listDescription}`,
    );
    list.classList.add('h5p-sort-paragraphs-list');

    paragraphs.forEach((paragraph, index) => {

      // Add n paragraphs
      list.appendChild(paragraph.getDOM());

      // Add n - 1 separators
      if (index !== paragraphs.length - 1) {
        list.appendChild(this.separators[index].getDOM());
      }
    });

    return list;
  }

  /**
   * Build paragraph.
   * @param {string} text Paragraph text.
   * @returns {SortParagraphsParagraph} Paragraph.
   */
  buildParagraph(text) {
    const paragraph = new SortParagraphsParagraph(
      {
        text: text,
        l10n: this.params.l10n,
        options: {
          addButtonsForMovement: this.params.addButtonsForMovement,
        },
      },
      {
        onMoveUp: ((draggable) => this.handleDraggableMoved(draggable, 'up')),
        onMoveDown: ((draggable) => this.handleDraggableMoved(draggable, 'down')),
        onFocusOut: ((draggable) => this.handleDraggableFocusOut(draggable)),
        onDragStart: ((draggable) => this.handleDraggableDragStart(draggable)),
        onDragEnter: ((draggable) => this.handleDraggableDragEnter(draggable)),
        onDragLeave: ((draggable) => this.handleDraggableDragLeave(draggable)),
        onDragEnd: ((draggable) => this.handleDraggableDragEnd(draggable)),
        onKeyboardUp: ((draggable) => this.handleDraggableKeyboardMoved(draggable, 'up')),
        onKeyboardDown: ((draggable) => this.handleDraggableKeyboardMoved(draggable, 'down')),
        onKeyboardSelect: ((draggable) => this.handleDraggableKeyboardSelect(draggable)),
        onKeyboardCancel: ((draggable) => this.handleDraggableKeyboardCancel(draggable)),
        onMouseDown: ((draggable) => this.handleDraggableMouseDown(draggable)),
        onMouseUp: ((draggable) => this.handleDraggableMouseUp(draggable)),
      },
    );
    return paragraph;
  }

  /**
   * Build ARIA templates for specific purposes.
   *
   * Tries to compose the messages in a way that a screen reader would read.
   * @returns {string[]} ARIA templates.
   */
  buildAriaTemplates() {
    return {
      // draggable was selected by giving focus
      // eslint-disable-next-line @stylistic/js/max-len
      selected: `${this.params.a11y.paragraph} ${this.params.a11y.sevenOfNine}. ${this.isAnswerGiven() ? '' : `${this.params.a11y.instructionsSelected  }. `}@text`,

      // draggable was grabbed
      // eslint-disable-next-line @stylistic/js/max-len
      grabbed: `${this.params.a11y.paragraph} ${this.params.a11y.grabbed}. ${this.params.a11y.currentPosition}: ${this.params.a11y.sevenOfNine}. ${this.isAnswerGiven() ? '' : `${this.params.a11y.instructionsGrabbed  }.`}`,

      // draggable was moved
      // eslint-disable-next-line @stylistic/js/max-len
      moved: `${this.params.a11y.paragraph} ${this.params.a11y.moved}. ${this.params.a11y.currentPosition}: ${this.params.a11y.sevenOfNine}.`,

      // draggable was dropped
      // eslint-disable-next-line @stylistic/js/max-len
      dropped: `${this.params.a11y.paragraph} ${this.params.a11y.dropped}. ${this.params.a11y.finalPosition}: ${this.params.a11y.sevenOfNine}.`,

      // draggable reordering was cancelled
      // eslint-disable-next-line @stylistic/js/max-len
      cancelled: `${this.params.a11y.reorderCancelled}. ${this.params.a11y.paragraph} ${this.params.a11y.sevenOfNine}. ${this.isAnswerGiven() ? '' : `${this.params.a11y.instructionsSelected  }. `}@text`,

      // Anncouncing results for scoring mode 'positions'
      resultPositions: `${this.params.a11y.paragraph} ${this.params.a11y.sevenOfNine}. @result. @points. @text`,

      // Anncouncing results for scoring mode 'transitions'
      // eslint-disable-next-line @stylistic/js/max-len
      resultTransitions: `${this.params.a11y.paragraph} ${this.params.a11y.sevenOfNine}. ${this.params.a11y.nextParagraph} @result. @points. @text`,

      // Neutral announcement for last draggable for scoring mode 'transitions'
      neutral: `${this.params.a11y.paragraph} ${this.params.a11y.sevenOfNine}. @text`,

      // Anncouncing solution
      solution: `${this.params.a11y.correctParagraph} ${this.params.a11y.sevenOfNine}. @text`,
    };
  }

  /**
   * Handle draggable moved up or down with button.
   * @param {HTMLElement} draggable Draggable.
   * @param {string} direction Either 'up' or 'down'.
   */
  handleDraggableMoved(draggable, direction) {
    const position = this.getDraggableIndex(draggable);

    let swapPosition;
    if (direction === 'up' && position > 0) {
      swapPosition = position - 1;
    }
    else if (direction === 'down' && position < this.paragraphs.length) {
      swapPosition = position + 1;
    }

    if (swapPosition !== undefined) {
      this.handleInteracted();

      // Animate draggables involved for visual feedback
      this.swapDOMElements(draggable, this.getDraggableAt(swapPosition), () => {
        this.resetDraggablesTabIndex();
        this.resetDraggables();
        this.resetAriaLabels();
      });
    }
  }

  /**
   * Handle draggable lost focus. Could be by mouse, could be by keyboard
   * @param {HTMLElement} draggable Draggable element.
   */
  handleDraggableFocusOut(draggable) {
    this.getParagraph(draggable).unselect();
    this.resetAriaLabels();

    // focusout is handled before mouseup, the selectedDraggable may be needed
    if (!this.isMouseDownOnDraggable) {
      this.selectedDraggable = null;
    }
  }

  /**
   * Handle dragging started.
   * @param {HTMLElement} draggable Draggable element.
   */
  handleDraggableDragStart(draggable) {
    this.oldOrder = this.getDraggablesOrder();
    this.draggedElement = draggable;

    this.getDraggables().forEach((draggable) => {
      this.getParagraph(draggable).hideButtons();
    });
  }

  /**
   * Handle draggable entered another draggable.
   * @param {HTMLElement} draggable Draggable element.
   */
  handleDraggableDragEnter(draggable) {
    if (this.dropzoneElement && this.dropzoneElement === draggable) {
      return; // Prevent jumping when paragraph is smaller than others
    }

    this.dropzoneElement = draggable;

    // Swap dragged draggable and draggable that's dragged to if not identical
    if (this.dropzoneElement && this.draggedElement && this.draggedElement !== this.dropzoneElement) {
      Util.swapDOMElements(this.draggedElement, this.dropzoneElement);
      this.getParagraph(this.draggedElement).attachPlaceholder();
    }
  }

  /**
   * Handle draggable left another draggable.
   */
  handleDraggableDragLeave() {
    this.dropzoneElement = null;
  }

  /**
   * Handle dragging ended.
   */
  handleDraggableDragEnd() {
    // Check whether a draggable has been moved
    const newOrder = this.getDraggablesOrder();
    if (this.oldOrder.some((item, index) => item !== newOrder[index])) {
      this.handleInteracted();
    }

    this.getDraggables().forEach((draggable) => {
      this.getParagraph(draggable).showButtons();
    });

    this.resetDraggables();

    this.draggedElement.focus();

    this.selectedDraggable = null;
    this.draggedElement = null;
    this.dropzoneElement = null;
    this.oldOrder = null;
  }

  /**
   * Handle user moved up or down with keyboard
   * @param {HTMLElement} draggable Draggable that was moved.
   * @param {string} direction Either 'up' or 'down'.
   */
  handleDraggableKeyboardMoved(draggable, direction) {
    const position = this.getDraggableIndex(draggable);

    if (
      direction === 'up' && position <= 0 ||
      direction === 'down' && position >= this.paragraphs.length - 1 ||
      direction !== 'up' && direction !== 'down'
    ) {
      return; // At outer position or invalid direction
    }

    const swapDraggablePosition = position + ((direction === 'up') ? -1 : 1);

    // Get draggable to swap with
    const swapDraggable = this.getDraggables()[swapDraggablePosition];
    const paragraph = this.getParagraph(draggable);
    const swapParagraph = this.getParagraph(swapDraggable);

    if (paragraph.isSelected()) {
      // Was grabbing, so swap draggables
      Util.swapDOMElements(draggable, swapDraggable);

      this.resetDraggables();
      this.resetAriaLabels();
      this.setAriaLabel(draggable, { action: 'moved' });

      // Moving node triggers focusout, get focus state and moving state back
      draggable.focus();

      paragraph.select();
    }
    else {
      // Only moving focus
      paragraph.setTabIndex(-1);
      swapParagraph.setTabIndex(0);
      swapParagraph.focus();
    }
  }

  /**
   * Handle user grabbed/ungrabbed a draggable
   * @param {HTMLElement} draggable Draggable that was grabbed/ungrabbed.
   */
  handleDraggableKeyboardSelect(draggable) {
    const paragraph = this.getParagraph(draggable);

    if (!paragraph.isSelected()) {
      // Starting to grab.
      this.setAriaLabel(draggable, { action: 'grabbed' });
      paragraph.select();

      this.selectedDraggable = draggable;

      // Store state in case user cancels
      this.undoState = {
        position: this.getDraggableIndex(draggable),
        order: this.getDraggablesOrder(),
      };
    }
    else {
      // Stopped grabbing.
      if (this.undoState && this.undoState.position !== this.getDraggableIndex(draggable)) {
        this.handleInteracted();
      }

      this.setAriaLabel(draggable, { action: 'dropped' });
      paragraph.unselect();

      this.selectedDraggable = null;

      // Collecting garbage
      this.undoState = null;
    }
  }

  /**
   * Handle user cancelled a move with keyboard.
   * @param {HTMLElement} draggable Draggable that had focus.
   */
  handleDraggableKeyboardCancel(draggable) {
    const paragraph = this.getParagraph(draggable);
    paragraph.unselect();

    this.resetAriaLabels();

    // Restore paragraphs' state and focus to start paragraph
    if (this.undoState) {
      this.reorderDraggables(this.undoState.order);

      paragraph.setTabIndex(-1);
      const oldFocusDraggable = this.getDraggableAt(this.undoState.position);

      oldFocusDraggable.setAttribute('tabIndex', 0);
      oldFocusDraggable.focus();

      // Keep this afer focus() or focusout handler will reset aria
      this.resetDraggables();
      this.resetAriaLabels();
      this.setAriaLabel(oldFocusDraggable, { action: 'cancelled' });

      this.undoState = null;
    }
  }

  /**
   * Handle user grabbed/ungrabbed a draggable.
   * @param {HTMLElement} draggable Draggable that was grabbed/ungrabbed.
   */
  handleDraggableMouseDown(draggable) {
    this.isMouseDownOnDraggable = true;

    const paragraph = this.getParagraph(draggable);
    paragraph.toggleEffect('selected', true);
  }

  /**
   * Handle user grabbed/ungrabbed a draggable.
   * @param {HTMLElement} draggable Draggable that was grabbed/ungrabbed.
   */
  handleDraggableMouseUp(draggable) {
    const paragraph = this.getParagraph(draggable);

    if (paragraph.isSelected()) {
      this.selectedDraggable = null;
      this.setAriaLabel(draggable, { action: 'dropped' });
      paragraph.unselect();
    }
    else {
      // Stopped grabbing.
      if (this.selectedDraggable !== null && this.selectedDraggable !== draggable) {
        this.handleInteracted();

        const draggableTarget = this.selectedDraggable;

        // Animate draggables involved for visual feedback
        this.swapDOMElements(draggable, draggableTarget, () => {
          this.resetDraggables();
          this.resetAriaLabels();

          this.setAriaLabel(draggableTarget, { action: 'dropped' });

          // Moving node triggers focusout, get focus state and moving state back
          draggableTarget.focus();

          this.selectedDraggable = null;
        });
      }
      else {
        // Starting to grab.
        this.setAriaLabel(draggable, { action: 'grabbed' });
        paragraph.select();

        this.selectedDraggable = draggable;
      }
    }

    this.isMouseDownOnDraggable = false;
  }

  /**
   * Handle user interacted.
   */
  handleInteracted() {
    this.answerGiven = true; // For H5P question type contract.
    this.ariaTemplates = this.buildAriaTemplates();
    this.callbacks.onInteracted();
  }

  /**
   * Enable content.
   */
  enable() {
    this.paragraphs.forEach((paragraph) => {
      paragraph.enable();
    });

    this.enabled = true;
  }

  /**
   * Disable content.
   */
  disable() {
    this.enabled = false;

    this.paragraphs.forEach((paragraph) => {
      paragraph.disable();
    });
  }

  /**
   * Determine whether an answer was given (H5P question type contract).
   * @returns {boolean} True, if answer as given.
   */
  isAnswerGiven() {
    return this.answerGiven;
  }

  /**
   * Get draggable at particular position.
   * @param {number} position Position.
   * @returns {HTMLElement|null} Draggable at position.
   */
  getDraggableAt(position) {
    if (typeof position !== 'number' || position < 0 || position > this.paragraphs.length - 1) {
      return null; // Invalid position
    }

    return this.getDraggables()[position];
  }

  /**
   * Get the draggables' current order.
   * @returns {number[]} Sequence of positions of draggables in contrast to solution.
   */
  getDraggablesOrder() {
    return this.getDraggables()
      .map((draggable) => this.paragraphs.indexOf(this.getParagraph(draggable)));
  }

  /**
   * Get current Position of Draggable.
   * @param {HTMLElement} draggable Draggable element.
   * @returns {number} Current position of draggable.
   */
  getDraggableIndex(draggable) {
    return this.getDraggables().indexOf(draggable);
  }

  /**
   * Get current draggables(' positions) from DOM.
   * @returns {HTMLElement[]} Draggables.
   */
  getDraggables() {
    return Array.from(this.list.querySelectorAll('.h5p-sort-paragraphs-paragraph'));
  }

  /**
   * Get paragraph for a draggable. Draggables are the DOM, paragraphs the objects.
   * @param {HTMLElement} draggable Draggable.
   * @returns {SortParagraphsParagraph} Paragraph.
   */
  getParagraph(draggable) {
    return this.paragraphs.reduce((result, paragraph) => {
      if (result !== null) {
        return result;
      }

      return (paragraph.getDOM() === draggable) ? paragraph : null;
    }, null);
  }

  /**
   * Set aria label for specific purpose.
   * @param {HTMLElement} draggable Draggable to set ARIA label for.
   * @param {object} options Options.
   * @param {string} options.action Action to set ARIA label for.
   * @param {string} [options.result] Wrong or correct text for some actions.
   * @param {string} [options.points] Points text for some actions.
   */
  setAriaLabel(draggable, options) {
    const position = this.getDraggableIndex(draggable) + 1; // Seven of ...
    const length = this.paragraphs.length; // ... nine
    const paragraph = this.getParagraph(draggable);
    const text = paragraph.getText();

    // Fill ARIA template for action
    let ariaLabel = this.ariaTemplates[options.action];
    ariaLabel = ariaLabel
      .replace('@current', position)
      .replace('@total', length)
      .replace('@text', text)
      .replace('@result', options.result || '')
      .replace('@points.', (options.points) ? `${options.points}. ` : '');

    if (ariaLabel.substr(-1) !== '.') {
      ariaLabel = `${ariaLabel}.`;
    }

    // Set ARIA label
    paragraph.setAriaLabel(Util.stripHTML(ariaLabel));

    // ARIA label changed, but that's not a state - will not re-announce
    if (['grabbed', 'dropped'].indexOf(options.action) !== -1) {
      this.callbacks.read(Util.stripHTML(ariaLabel));
    }
  }

  /**
   * Reset aria labels to default state beeing selected.
   */
  resetAriaLabels() {
    if (!this.enabled) {
      return;
    }

    // Update aria label texts
    if (this.previousAnswerState !== this.isAnswerGiven()) {
      this.previousAnswerState = this.isAnswerGiven();
      this.ariaTemplates = this.buildAriaTemplates();
    }

    this.getDraggables().forEach((draggable) => {
      this.setAriaLabel(draggable, { action: 'selected' });
    });
  }

  /**
   * Reset paragraphs' tabIndex to make first paragraph next tab stop.
   * @param {number} [value] Tabindex to set.
   */
  resetDraggablesTabIndex(value = null) {
    const draggables = this.getDraggables();
    draggables.forEach((draggable, index) => {
      const paragraph = this.getParagraph(draggable);
      if (index === 0) {
        paragraph.setTabIndex(value !== null ? value : 0);
      }
      else {
        paragraph.setTabIndex(value !== null ? value : -1);
      }
    });
  }

  /**
   * Reset draggables' styles and buttons.
   */
  resetDraggables() {
    const draggables = this.getDraggables();

    draggables.forEach((draggable, index) => {
      const paragraph = this.getParagraph(draggable);

      paragraph.toggleEffect('over', false);
      paragraph.toggleEffect('ghosted', false);

      if (index === 0) {
        paragraph.toggleButton('up', false);
        paragraph.toggleButton('down', true);
      }
      else if (index === draggables.length - 1) {
        paragraph.toggleButton('up', true);
        paragraph.toggleButton('down', false);
      }
      else {
        paragraph.toggleButton('up', true);
        paragraph.toggleButton('down', true);
      }
    });
  }

  /**
   * Swap two DOM elements with animation.
   * @param {HTMLElement} element1 Element 1.
   * @param {HTMLElement} element2 Element 2.
   * @param {function} done Callback when done.
   */
  swapDOMElements(element1, element2, done) {
    if (!element1 || !element1.parentNode || !element2 || !element2.parentNode) {
      return;
    }

    // Sort elements by position
    if (element1.offsetTop - element2.offsetTop > 0) {
      const tmp = element1;
      element1 = element2;
      element2 = tmp;
    }

    // Keep track of relevant elements
    this.transitionElement1 = element1;
    this.transitionElement2 = element2;
    this.transitionElements = this.getDraggables();
    this.transitionDone = done;

    this.transitionElements.forEach((element) => {
      const paragraph = this.getParagraph(element);
      paragraph.hideButtons();
      paragraph.unselect();
    });

    this.transitionElement1.addEventListener('transitionend', this.handleSwapTransitionEnded);

    // Translate elements to new final position
    setTimeout(() => {
      this.transitionElements
        .forEach((element) => {
          const paragraph = this.getParagraph(element);

          let offset;

          if (element === this.transitionElement1) {
            offset = -1 * (
              this.transitionElement1.offsetTop -
              this.transitionElement2.offsetTop -
              this.transitionElement2.offsetHeight +
              this.transitionElement1.offsetHeight
            );
          }
          else if (element === this.transitionElement2) {
            offset = -1 * (this.transitionElement2.offsetTop - this.transitionElement1.offsetTop);
          }
          else {
            offset = (element.offsetTop < element1.offsetTop || element.offsetTop > element2.offsetTop) ?
              0 :
              this.transitionElement2.offsetHeight - this.transitionElement1.offsetHeight;
          }

          paragraph.translate({ y: offset });
          paragraph.disable(); // Here, because animation influences disable visuals
        });
    }, 0);
  }

  /**
   * Handle swap with transition ended.
   */
  handleSwapTransitionEnded() {
    Util.swapDOMElements(this.transitionElement1, this.transitionElement2);

    this.getDraggables().forEach((element) => {
      element.removeEventListener('transitionend', this.handleSwapTransitionEnded);
      this.getParagraph(element).translate(); // Reset translation

      if (this.viewState === 'task') {
        this.getParagraph(element).showButtons();
        this.getParagraph(element).enable();
      }
    });

    this.transitionDone();
  }

  /**
   * Reset content.
   */
  reset() {
    this.list.setAttribute(
      'aria-label',
      `${this.params.taskDescription} ${this.params.a11y.listDescription}`,
    );

    this.answerGiven = false;
    this.ariaTemplates = this.buildAriaTemplates();

    this.hideResults();

    this.paragraphs.forEach((paragraph) => {
      paragraph.toggleEffect('correct', false);
      paragraph.toggleEffect('wrong', false);
      paragraph.toggleEffect('solution', false);
      paragraph.showButtons();
    });

    Util.shuffleDOMElements(this.paragraphs.map((paragraph) => paragraph.getDOM()));

    this.enable();

    this.resetDraggablesTabIndex();
    this.resetDraggables();
    this.resetAriaLabels();
    this.setViewState('task');

    this.focusFirstDraggable(FOCUS_DELAY_SMALL);
  }

  /**
   * Set view state.
   * @param {string|number} [newState] State to set, defaulting to 'task'.
   */
  setViewState(newState = 0) {
    if (typeof newState === 'number') {
      newState = Object.entries(this.viewStates).find((entry) => {
        return entry[1] === newState;
      })?.[0];

      if (!newState) {
        return;
      }
    }

    if (!Object.keys(this.viewStates).includes(newState)) {
      return;
    }

    Object.keys(this.viewStates).forEach((state) => {
      this.content.classList.toggle(
        `h5p-sort-paragraphs-view-state-${state}`,
        state !== newState,
      );
    });

    this.viewState = newState;
  }

  /**
   * Resize.
   */
  resize() {
    let buttonsVertical;
    if (this.viewState !== 'task') {
      buttonsVertical = false;
    }
    else {
      buttonsVertical = this.paragraphs.every((paragraph) => {
        return paragraph.doButtonsFitVertically();
      });
    }

    this.paragraphs.forEach((paragraph) => {
      paragraph.setButtonsVertical(buttonsVertical);
    });
  }
}
