// Import required classes
import "core-js/es/array/from";
import Util from './h5p-sort-paragraphs-util';
import SortParagraphsParagraph from './h5p-sort-paragraphs-paragraph';
import SortParagraphsSeparator from './h5p-sort-paragraphs-separator';

/** Class representing the content */
export default class SortParagraphsContent {
  /**
   * @constructor
   * @param {object} params Parameters.
   * @param {object} [callbacks = {}] Callbacks.
   */
  constructor(params = {}, callbacks = {}) {
    this.params = params;

    this.callbacks = Util.extend({
      onInteracted: () => {}
    }, callbacks);

    this.content = document.createElement('div');
    this.content.classList.add('h5p-sort-paragraphs-content');

    this.draggedElement = null; // Currently dragged element
    this.answerGiven = false; // Answer given for H5P question type contract
    this.enabled = true; // Enabled state of content
    this.oldOrder = null; // Old order when dragging

    // Original position of selected draggable
    this.selectedDraggable = null;

    // Register state of mouse button on draggable
    this.isMouseDownOnDraggable = false;

    // View/handling options
    this.options = {
      scoringMode: params.scoringMode || 'transitions',
      penalties: (typeof params.penalties !== 'boolean') ? true : params.penalties,
      showArrows: params.showArrows,
      duplicatesInterchangeable: params.duplicatesInterchangeable
    };

    // ARIA label texts
    this.ariaTemplates = this.buildAriaTemplates();

    // Task description
    const taskDescription = document.createElement('div');
    taskDescription.classList.add('h5p-sort-paragraphs-task-description');
    taskDescription.innerHTML = params.taskDescription;
    this.content.appendChild(taskDescription);

    // Build n paragraphs
    this.paragraphs = params.paragraphs
      .map(paragraph => this.buildParagraph(paragraph));

    // Build n-1 separators for transitions
    this.separators = [];
    params.paragraphs.forEach((paragraph, index) => {
      if (index === params.paragraphs.length - 2) {
        return;
      }
      this.separators.push(new SortParagraphsSeparator({
        hidden: !this.options.showArrows
      }));
    });

    // Build list of paragraphs
    this.list = this.buildList(this.paragraphs);
    this.content.appendChild(this.list);

    // Use previous state or shuffle paragraphs
    if (params.previousState && params.previousState.order) {
      this.reorderDraggables(params.previousState.order);
    }
    else {
      Util.shuffleDOMElements(this.paragraphs.map(paragraph => paragraph.getDOM()));
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
   * @return {HTMLElement} DOM for this class.
   */
  getDOM() {
    return this.content;
  }

  /**
   * Show results.
   */
  showResults() {
    const results = this.computeResults();

    // Hide buttons
    this.paragraphs.forEach(paragraph => {
      paragraph.hideButtons();
    });

    // Add score explanation and ARIA depending on scoring mode.
    if (this.options.scoringMode === 'positions') {
      this.showScoreExplanation(this.getDraggables().map(draggable => this.getParagraph(draggable)), results);
      this.addScoreAria(this.getDraggables(), results);
    }
    else if (this.options.scoringMode === 'transitions') {
      this.showScoreExplanation(this.separators, results);
      this.addScoreAria(this.getDraggables(), results);
      this.setAriaLabel(this.getDraggables().pop(), {action: 'neutral'});
    }

    this.resetDraggablesTabIndex();
  }

  /**
   * Hide results.
   */
  hideResults() {
    const elements = this.paragraphs.concat(this.separators);

    elements.forEach(element => {
      element.toggleEffect('correct', false);
      element.toggleEffect('wrong', false);
      element.setAriaLabel('');
      element.removeScoreExplanation();
    });
  }

  /**
   * Show solutions.
   */
  showSolutions() {
    this.hideResults();

    // Move draggables in correct order
    this.paragraphs.forEach((paragraph, index) => {
      paragraph.toggleEffect('solution', true);

      const draggables = this.getDraggables();
      const position = draggables.indexOf(paragraph.getDOM());

      if (position !== index) {
        Util.swapDOMElements(draggables[index], draggables[position]);
      }
    });

    this.resetAriaLabels();
    this.resetDraggablesTabIndex();
    this.getDraggables().forEach(draggable => {
      this.setAriaLabel(draggable, {action: 'solution'});
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

      if (answer === true) {
        this.setAriaLabel(element, {
          action: (this.options.scoringMode === 'positions') ? 'resultPositions' : 'resultTransitions',
          result: this.params.a11y.correct,
          points: this.params.a11y.point.replace('@score', 1)
        });
      }
      else {
        const showMinus = (this.options.penalties && this.options.scoringMode === 'positions');
        this.setAriaLabel(element, {
          action: (this.options.scoringMode === 'positions') ? 'resultPositions' : 'resultTransitions',
          result: this.params.a11y.wrong,
          points: (showMinus) ? this.params.a11y.point.replace('@score', -1) : undefined
        });
      }
    });
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
   * @return {object} Results.
   */
  computeResults() {
    let score = 0;
    let correctAnswers;

    // Determine paragraph id at each position.
    const draggables = this.getDraggables();
    const paragraphs = this.paragraphs.map(paragraph => paragraph.getDOM());
    const ids = draggables.map(draggable => paragraphs.indexOf(draggable));

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

      const draggablesPlain = draggables.map(draggable => draggable.innerText);
      const paragraphsPlain = paragraphs.map(paragraph => paragraph.innerText);

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
      score: Math.max(0, score)
    };
  }

  /**
   * Build list of paragraphs.
   * @param {SortParagraphsParagraph[]} paragraphs Paragraphs.
   * @return {HTMLElement} List of paragpraphs.
   */
  buildList(paragraphs) {
    const list = document.createElement('div');
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', 'Listbox');
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
   * @return {SortParagraphsParagraph} Paragraph.
   */
  buildParagraph(text) {
    const paragraph = new SortParagraphsParagraph(
      {
        text: text,
        l10n: this.params.l10n
      },
      {
        onMoveUp: (draggable => this.handleDraggableMoveUp(draggable)),
        onMoveDown: (draggable => this.handleDraggableMoveDown(draggable)),
        onFocusOut: (draggable => this.handleDraggableFocusOut(draggable)),
        onDragStart: (draggable => this.handleDraggableDragStart(draggable)),
        onDragOver: (draggable => this.handleDraggableDragOver(draggable)),
        onDragEnter: (draggable => this.handleDraggableDragEnter(draggable)),
        onDragLeave: (draggable => this.handleDraggableDragLeave(draggable)),
        onDragEnd: (draggable => this.handleDraggableDragEnd(draggable)),
        onKeyboardUp: (draggable => this.handleDraggableKeyboardUp(draggable)),
        onKeyboardDown: (draggable => this.handleDraggableKeyboardDown(draggable)),
        onKeyboardSelect: (draggable => this.handleDraggableKeyboardSelect(draggable)),
        onKeyboardCancel: (draggable => this.handleDraggableKeyboardCancel(draggable)),
        onMouseDown: (draggable => this.handleDraggableMouseDown(draggable)),
        onMouseUp: (draggable => this.handleDraggableMouseUp(draggable))
      }
    );
    return paragraph;
  }

  /**
   * Build ARIA tamplates for specific purposes.
   * @return {string[]} ARIA templates.
   */
  buildAriaTemplates() {
    return {
      // draggable was selected by giving focus
      selected: `Listbox. ${this.params.a11y.paragraph} ${this.params.a11y.sevenOfNine}. ${this.isAnswerGiven() ? '' : this.params.a11y.instructionsSelected + '. '}${this.params.a11y.paragraphText}: @text`,

      // draggable was grabbed
      grabbed: `${this.params.a11y.paragraph} ${this.params.a11y.grabbed}. ${this.params.a11y.currentPosition}: ${this.params.a11y.sevenOfNine}. ${this.isAnswerGiven() ? '' : this.params.a11y.instructionsGrabbed + '.'}`,

      // draggable was moved
      moved: `${this.params.a11y.paragraph} ${this.params.a11y.moved}. ${this.params.a11y.currentPosition}: ${this.params.a11y.sevenOfNine}.`,

      // draggable was dropped
      dropped: `${this.params.a11y.paragraph} ${this.params.a11y.dropped}. ${this.params.a11y.finalPosition}: ${this.params.a11y.sevenOfNine}.`,

      // draggable reordering was cancelled
      cancelled: `${this.params.a11y.reorderCancelled}. Listbox. ${this.params.a11y.paragraph} ${this.params.a11y.sevenOfNine}. ${this.isAnswerGiven() ? '' : this.params.a11y.instructionsSelected + '. '}${this.params.a11y.paragraphText}: @text`,

      // Anncouncing results for scoring mode 'positions'
      resultPositions: `${this.params.a11y.paragraph} ${this.params.a11y.sevenOfNine}. @result. @points.@text`,

      // Anncouncing results for scoring mode 'transitions'
      resultTransitions: `${this.params.a11y.paragraph} ${this.params.a11y.sevenOfNine}. ${this.params.a11y.nextParagraph} @result. @points.@text`,

      // Neutral announcement for last draggable for scoring mode 'transitions'
      neutral: `${this.params.a11y.paragraph} ${this.params.a11y.sevenOfNine}. @text`,

      // Anncouncing solution
      solution: `${this.params.a11y.correctParagraph} ${this.params.a11y.sevenOfNine}. @text`
    };
  }

  /**
   * Handle draggable moved up with button.
   */
  handleDraggableMoveUp(draggable) {
    const position = this.getDraggableIndex(draggable);
    if (position > 0) {
      this.answerGiven = true; // For H5P question type contract.
      this.callbacks.onInteracted();

      Util.swapDOMElements(draggable, this.getDraggableAt(position - 1));

      this.resetDraggablesTabIndex();
      this.resetDraggables();
      this.resetAriaLabels();
    }
  }

  /**
   * Handle draggable moved down with button.
   */
  handleDraggableMoveDown(draggable) {
    const position = this.getDraggableIndex(draggable);
    if (position < this.paragraphs.length) {
      this.answerGiven = true; // For H5P question type contract.
      this.callbacks.onInteracted();

      Util.swapDOMElements(draggable, this.getDraggableAt(position + 1));

      this.resetDraggablesTabIndex();
      this.resetDraggables();
      this.resetAriaLabels();
    }
  }

  /**
   * Handle draggable lost focus. Could be by mouse, could be by keyboard
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
   */
  handleDraggableDragStart(draggable) {
    this.oldOrder = this.getDraggablesOrder();
    this.draggedElement = draggable;
  }

  /**
   * Handle draggable over another draggable.
   */
  handleDraggableDragOver() {
  }

  /**
   * Handle draggable entered another draggable.
   */
  handleDraggableDragEnter(draggable) {
    this.dropzoneElement = draggable;

    // Swap dragged draggable and draggable that's dragged to if not identical
    if (this.dropzoneElement && this.draggedElement !== this.dropzoneElement) {
      Util.swapDOMElements(this.draggedElement, this.dropzoneElement);
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
      this.answerGiven = true; // For H5P question type contract.
      this.callbacks.onInteracted();
    }

    this.resetDraggables();

    this.selectedDraggable = null;
    this.draggedElement = null;
    this.dropzoneElement = null;
    this.oldOrder = null;
  }

  /**
   * Handle user moved up with keyboard
   * @param {HTMLElement} draggable Draggable that was moved.
   */
  handleDraggableKeyboardUp(draggable) {
    const position = this.getDraggableIndex(draggable);
    if (position <= 0) {
      return; // Already at top.
    }

    // Get previous draggable
    const previousDraggable = this.getDraggables()[position - 1];
    const paragraph = this.getParagraph(draggable);
    const previousParagraph = this.getParagraph(previousDraggable);

    if (paragraph.isSelected()) {
      // Was grabbing, so swap draggables
      Util.swapDOMElements(draggable, previousDraggable);

      this.resetDraggables();
      this.resetAriaLabels();
      this.setAriaLabel(draggable, {action: 'moved'});

      // Moving node triggers focusout, get focus state and moving state back
      draggable.focus();

      paragraph.select();
    }
    else {
      // Only moving focus
      paragraph.setTabIndex(-1);
      previousParagraph.setTabIndex(0);
      previousParagraph.focus();
    }
  }

  /**
   * Handle user moved down with keyboard
   * @param {HTMLElement} draggable Draggable that was moved.
   */
  handleDraggableKeyboardDown(draggable) {
    const position = this.getDraggableIndex(draggable);
    if (position >= this.paragraphs.length - 1) {
      return; // Already at bottom.
    }

    // Get next draggable
    const nextDraggable = this.getDraggables()[position + 1];
    const paragraph = this.getParagraph(draggable);
    const nextParagraph = this.getParagraph(nextDraggable);

    if (paragraph.isSelected()) {
      // Was grabbing, so swap draggables
      Util.swapDOMElements(draggable, nextDraggable);

      this.resetDraggables();
      this.resetAriaLabels();
      this.setAriaLabel(draggable, {action: 'moved'});

      // Moving node triggers focusout, get focus state and moving state back
      draggable.focus();

      paragraph.select();
    }
    else {
      // Only moving focus
      paragraph.setTabIndex(-1);
      nextParagraph.setTabIndex(0);
      nextParagraph.focus();
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
      this.setAriaLabel(draggable, {action: 'grabbed'});
      paragraph.select();

      // Store state in case user cancels
      this.undoState = {
        position: this.getDraggableIndex(draggable),
        order: this.getDraggablesOrder()
      };
    }
    else {
      // Stopped grabbing.
      if (this.undoState && this.undoState.position !== this.getDraggableIndex(draggable)) {
        this.answerGiven = true; // Moved to different position.
        this.callbacks.onInteracted();
      }

      this.setAriaLabel(draggable, {action: 'dropped'});
      paragraph.unselect();

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
      this.setAriaLabel(oldFocusDraggable, {action: 'cancelled'});

      this.undoState = null;
    }
  }

  /**
   * Handle user grabbed/ungrabbed a draggable.
   */
  handleDraggableMouseDown() {
    this.isMouseDownOnDraggable = true;
  }

  /**
   * Handle user grabbed/ungrabbed a draggable.
   * @param {HTMLElement} draggable Draggable that was grabbed/ungrabbed.
   */
  handleDraggableMouseUp(draggable) {
    const paragraph = this.getParagraph(draggable);

    if (paragraph.isSelected()) {
      this.selectedDraggable = null;
      this.setAriaLabel(draggable, {action: 'dropped'});
      paragraph.unselect();
    }
    else {
      // Stopped grabbing.
      if (this.selectedDraggable !== null && this.selectedDraggable !== draggable) {
        this.answerGiven = true; // Moved to different position.
        this.callbacks.onInteracted();
        const draggableTarget = this.selectedDraggable;
        Util.swapDOMElements(draggable, draggableTarget);

        this.resetDraggables();
        this.resetAriaLabels();

        this.setAriaLabel(draggableTarget, {action: 'dropped'});

        // Moving node triggers focusout, get focus state and moving state back
        draggableTarget.focus();

        this.selectedDraggable = null;
      }
      else {
        // Starting to grab.
        this.setAriaLabel(draggable, {action: 'grabbed'});
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
    this.callbacks.onInteracted();
  }

  /**
   * Enable content.
   */
  enable() {
    this.paragraphs.forEach(paragraph => {
      paragraph.enable();
    });

    this.enabled = true;
  }

  /**
   * Disable content.
   */
  disable() {
    this.enabled = false;

    this.paragraphs.forEach(paragraph => {
      paragraph.disable();
    });
  }

  /**
   * Determine whether an answer was given (H5P question type contract).
   * @return {boolean} True, if answer as given.
   */
  isAnswerGiven() {
    return this.answerGiven;
  }

  /**
   * Get draggable at particular position.
   * @param {number} Position.
   * @return {HTMLElement|null} Draggable at position.
   */
  getDraggableAt(position) {
    if (typeof position !== 'number' || position < 0 || position > this.paragraphs.length - 1) {
      return null; // Invalid position
    }

    return this.getDraggables()[position];
  }

  /**
   * Get the draggables' current order.
   * @return {number[]} Sequence of positions of draggables in contrast to solution.
   */
  getDraggablesOrder() {
    return this.getDraggables()
      .map(draggable => this.paragraphs.indexOf(this.getParagraph(draggable)));
  }

  /**
   * Get current Position of Draggable.
   * @param {HTMLElement} Draggable.
   * @return {number} Current position of draggable.
   */
  getDraggableIndex(draggable) {
    return this.getDraggables().indexOf(draggable);
  }

  /**
   * Get current draggables(' positions) from DOM.
   * @return {HTMLElement[]} Draggables.
   */
  getDraggables() {
    return Array.from(this.list.querySelectorAll('.h5p-sort-paragraphs-paragraph'));
  }

  /**
   * Get paragraph for a draggable. Draggables are the DOM, paragraphs the objects.
   * @param {HTMLElement} draggable Draggable.
   * @return {SortParagraphsParagraph} Paragraph.
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

    // Set ARIA label
    paragraph.setAriaLabel(Util.stripHTML(ariaLabel));
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

    this.getDraggables().forEach(draggable => {
      this.setAriaLabel(draggable, {action: 'selected'});
    });
  }

  /**
   * Reset paragraphs' tabIndex to make first paragraph next tab stop.
   * @param {number} [value=null] Tabindex to set.
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
   * Reset content.
   */
  reset() {
    this.answerGiven = false;

    this.hideResults();

    this.paragraphs.forEach(paragraph => {
      paragraph.toggleEffect('correct', false);
      paragraph.toggleEffect('wrong', false);
      paragraph.toggleEffect('solution', false);
      paragraph.showButtons();
    });

    Util.shuffleDOMElements(this.paragraphs.map(paragraph => paragraph.getDOM()));

    this.enable();

    this.resetDraggablesTabIndex();
    this.resetDraggables();
    this.resetAriaLabels();
  }
}
