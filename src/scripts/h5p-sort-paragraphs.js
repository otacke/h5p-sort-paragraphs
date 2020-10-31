// Import required classes
import SortParagraphsContent from './h5p-sort-paragraphs-content';
import Util from './h5p-sort-paragraphs-util';

/**
 * Main class.
 */
export default class SortParagraphs extends H5P.Question {
  /**
   * @constructor
   * @param {object} params Parameters passed by the editor.
   * @param {number} contentId Content's id.
   * @param {object} [extras] Saved state, metadata, etc.
   */
  constructor(params, contentId, extras = {}) {
    super('sort-paragraphs'); // CSS class selector for content's iframe

    /*
     * this.params.behaviour.enableSolutionsButton and this.params.behaviour.enableRetry
     * are used by H5P's question type contract.
     * @see {@link https://h5p.org/documentation/developers/contracts#guides-header-8}
     * @see {@link https://h5p.org/documentation/developers/contracts#guides-header-9}
     */

    // Make sure all variables are set
    this.params = Util.extend({
      taskDescription: null,
      paragraphs: [],
      behaviour: {
        enableSolutionsButton: true,
        enableRetry: true,
        scoringMode: 'transitions',
        applyPenalties: true,
        arrowsPositions: false
      },
      l10n: {
        checkAnswer: 'Check answer',
        showSolution: 'Show solution',
        tryAgain: 'Retry',
        up: 'Up',
        down: 'Down',
        disabled: 'Disabled'
      },
      a11y: {
        paragraph: 'Paragraph',
        sevenOfNine: '@current of @total',
        instructionsSelected: 'Press spacebar to reorder',
        paragraphText: 'Paragraph text',
        grabbed: 'grabbed',
        currentPosition: 'Current position in list',
        instructionsGrabbed: 'Press up and down arrow keys to change position, spacebar to drop, escape to cancel',
        moved: 'moved',
        dropped: 'dropped',
        finalPosition: 'Final position',
        reorderCancelled: 'Reorder cancelled',
        correct: 'correct',
        wrong: 'wrong',
        point: '@score point',
        nextParagraph: 'Next paragraph',
        correctParagraph: 'Correct paragraph at position'
      }
    }, params);

    this.contentId = contentId;
    this.extras = extras;

    // Sanitize for use as text
    for (let word in this.params.l10n) {
      this.params.l10n[word] = Util.stripHTML(Util.htmlDecode(this.params.l10n[word]));
    }

    const defaultLanguage = (extras && extras.metadata) ? extras.metadata.defaultLanguage || 'en' : 'en';
    this.languageTag = Util.formatLanguageCode(defaultLanguage);

    // Current user view
    this.viewState = 'task';

    // this.previousState now holds the saved content state of the previous session
    this.previousState = (this.extras.previousState && this.extras.previousState.order) || null;

    /**
     * Register the DOM elements with H5P.Question
     */
    this.registerDomElements = () => {
      let showArrows;
      if (this.params.behaviour.scoringMode === 'positions') {
        showArrows = this.params.behaviour.arrowsPositions;
      }
      else if (this.params.behaviour.scoringMode === 'transitions') {
        showArrows = true;
      }

      this.content = new SortParagraphsContent(
        {
          paragraphs: this.params.paragraphs,
          taskDescription: this.params.taskDescription,
          showArrows: showArrows,
          penalties: this.params.behaviour.applyPenalties,
          scoringMode: this.params.behaviour.scoringMode,
          previousState: this.previousState,
          a11y: this.params.a11y,
          l10n: {
            up: this.params.l10n.up,
            down: this.params.l10n.down,
            disabled: this.params.l10n.disabled
          }
        }
      );

      // Register content with H5P.Question
      this.setContent(this.content.getDOM());

      if (this.previousState !== null && (this.previousState.view === 'results' || this.previousState.view === 'solutions')) {
        // Need to wait until DOM is ready for us
        H5P.externalDispatcher.on('initialized', () => {
          this.viewState = 'results';
          this.checkAnswer();
        });
      }

      // Register Buttons
      this.addButtons();

      this.trigger('resize');
    };

    /**
     * Add all the buttons that shall be passed to H5P.Question.
     */
    this.addButtons = () => {
      // Check answer button
      this.addButton('check-answer', this.params.l10n.checkAnswer, () => {
        this.checkAnswer();
      }, true, {}, {});

      // Show solution button
      this.addButton('show-solution', this.params.l10n.showSolution, () => {
        this.hideButton('show-solution');
        this.showSolutions();
      }, false, {}, {});

      // Retry button
      this.addButton('try-again', this.params.l10n.tryAgain, () => {
        this.showButton('check-answer');
        this.hideButton('show-solution');
        this.hideButton('try-again');

        this.resetTask();

        this.trigger('resize');
      }, false, {}, {});
    };

    /**
     * Check if result has been submitted or input has been given.
     * @return {boolean} True, if answer was given.
     * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-1}
     */
    this.getAnswerGiven = () => this.content.isAnswerGiven();

    /**
     * Get latest score.
     * @return {number} latest score.
     * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-2}
     */
    this.getScore = () => (this.content.computeResults({
      mode: this.params.behaviour.scoringMode,
      penalties: this.params.behaviour.applyPenalties
    })).score;

    /**
     * Get maximum possible score.
     * @return {number} Score necessary for mastering.
     * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-3}
     */
    this.getMaxScore = () => {
      const length = this.params.paragraphs.length;
      // For transitions mode, cound number of paragraph transitions
      return (this.params.behaviour.scoringMode === 'positions') ? length : length - 1;
    };

    /**
     * Show solutions.
     * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-4}
     */
    this.showSolutions = () => {
      this.viewState = 'solutions';
      this.content.showSolutions();
      this.trigger('resize');
    };

    /**
     * Reset task.
     * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-5}
     */
    this.resetTask = () => {
      this.removeFeedback();
      this.content.reset();
      this.viewState = 'task';
      this.trigger('resize');
    };

    /**
     * Get xAPI data.
     * @return {object} XAPI statement.
     * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-6}
     */
    this.getXAPIData = () => ({
      statement: this.getXAPIAnswerEvent().data.statement
    });

    /**
     * Build xAPI answer event.
     * @return {H5P.XAPIEvent} XAPI answer event.
     */
    this.getXAPIAnswerEvent = () => {
      const xAPIEvent = this.createXAPIEvent('answered');

      xAPIEvent.setScoredResult(this.getScore(), this.getMaxScore(), this,
        true, this.isPassed());

      xAPIEvent.data.statement.result.response = this.content.getDraggablesOrder().join('[,]');

      return xAPIEvent;
    };

    /**
     * Create an xAPI event.
     * @param {string} verb Short id of the verb we want to trigger.
     * @return {H5P.XAPIEvent} Event template.
     */
    this.createXAPIEvent = (verb) => {
      const xAPIEvent = this.createXAPIEventTemplate(verb);
      Util.extend(
        xAPIEvent.getVerifiedStatementValue(['object', 'definition']),
        this.getxAPIDefinition());
      return xAPIEvent;
    };

    /**
     * Get the xAPI definition for the xAPI object.
     * @return {object} XAPI definition.
     */
    this.getxAPIDefinition = () => {
      const definition = {};
      definition.name = {};
      definition.name[this.languageTag] = this.getTitle();
      definition.description = {};
      definition.description[this.languageTag] = Util.stripHTML(this.getDescription());
      definition.type = 'http://adlnet.gov/expapi/activities/cmi.interaction';
      definition.interactionType = 'sequencing';
      definition.correctResponsesPattern = [];
      this.params.paragraphs.forEach((paragraph, index) => {
        definition.correctResponsesPattern.push(index);
      });
      definition.correctResponsesPattern = definition.correctResponsesPattern.join('[,]');
      definition.choices = this.params.paragraphs.map((paragraph, index) => {
        paragraph = Util.stripHTML(paragraph);

        const choicesDescription = {};
        choicesDescription[this.languageTag] = paragraph;

        return {
          id: index,
          description: choicesDescription
        };
      });

      return definition;
    };

    /**
     * Check answer.
     */
    this.checkAnswer = () => {
      this.content.disable();

      this.hideButton('check-answer');

      if (this.params.behaviour.enableSolutionsButton && this.getScore() !== this.getMaxScore()) {
        this.showButton('show-solution');
      }

      if (this.params.behaviour.enableRetry) {
        this.showButton('try-again');
      }

      this.content.showResults({
        mode: this.params.behaviour.scoringMode,
        penalties: this.params.behaviour.applyPenalties
      });

      const textScore = H5P.Question.determineOverallFeedback(
        this.params.overallFeedback, this.getScore() / this.getMaxScore());

      // Output via H5P.Question
      const ariaMessage = this.params.a11y.yourResult
        .replace('@score', this.getScore())
        .replace('@total', this.getMaxScore());

      this.setFeedback(
        textScore.trim(),
        this.getScore(),
        this.getMaxScore(),
        ariaMessage
      );

      if (this.viewState === 'task') {
        // checkAnswer was mot triggered to recreate previous state
        this.trigger(this.getXAPIAnswerEvent());
        this.trigger(this.createXAPIEvent('completed')); // Store state
      }

      this.viewState = 'results';
    };

    /**
     * Determine whether the task has been passed by the user.
     * @return {boolean} True if user passed or task is not scored.
     */
    this.isPassed = () => this.getScore() >= this.getMaxScore();

    /**
     * Get task title.
     * @return {string} Title.
     */
    this.getTitle = () => {
      let raw;
      if (this.extras.metadata) {
        raw = this.extras.metadata.title;
      }
      raw = raw || SortParagraphs.DEFAULT_DESCRIPTION;

      // H5P Core function: createTitle
      return H5P.createTitle(raw);
    };

    /**
     * Get task description.
     * @return {string} Description.
     */
    this.getDescription = () => this.params.taskDescription || SortParagraphs.DEFAULT_DESCRIPTION;

    /**
     * Answer call to return the current state.
     * @return {object} Current state.
     */
    this.getCurrentState = () => {
      return {
        order: this.content.getDraggablesOrder(),
        view: this.viewState
      };
    };
  }
}

/** @constant {string} */
SortParagraphs.DEFAULT_DESCRIPTION = 'SortParagraphs';
