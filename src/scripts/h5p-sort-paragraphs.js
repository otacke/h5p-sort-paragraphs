// Import required classes
import SortParagraphsContent from './h5p-sort-paragraphs-content';
import Util from './h5p-sort-paragraphs-util';

/**
 * Main class.
 */
export default class SortParagraphs extends H5P.Question {
  /**
   * @class
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
      media: {},
      taskDescription: null,
      paragraphs: [],
      behaviour: {
        duplicatesInterchangeable: true,
        enableSolutionsButton: true,
        enableRetry: true,
        scoringMode: 'transitions',
        applyPenalties: true,
        addButtonsForMovement: true
      },
      l10n: {
        checkAnswer: 'Check answer',
        submitAnswer: 'Submit',
        showSolution: 'Show solution',
        tryAgain: 'Retry',
        up: 'Up',
        down: 'Down',
        disabled: 'Disabled'
      },
      a11y: {
        check: 'Check the answers. The responses will be marked as correct or incorrect.',
        showSolution: 'Show the solution. The correct solution will be displayed.',
        retry: 'Retry the task. Reset all elements and start the task over again.',
        listDescription: 'Sortable list of paragraphs.',
        listDescriptionCheckAnswer: 'List of paragraphs with results.',
        listDescriptionShowSolution: 'List of paragraphs with solutions.',
        paragraph: 'Paragraph',
        sevenOfNine: '@current of @total',
        instructionsSelected: 'Press spacebar to reorder',
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

    /*
     * Yes, I know, H5PIntegration should not be queried directly, but
     * H5P core doesn't provide this information to libraries.
     */
    this.canStoreState = !Number.isNaN(parseInt(H5PIntegration?.saveFreq));
    this.stateProvider = this.retrieveStateProvider();

    // Sanitize for use as text
    for (let word in this.params.l10n) {
      this.params.l10n[word] = Util.stripHTML(Util.htmlDecode(this.params.l10n[word]));
    }

    const defaultLanguage = (extras && extras.metadata) ? extras.metadata.defaultLanguage || 'en' : 'en';
    this.languageTag = Util.formatLanguageCode(defaultLanguage);

    // this.previousState now holds the saved content state of the previous session
    this.previousState = (this.extras.previousState && this.extras.previousState.order) ?
      this.extras.previousState :
      null;

    this.content = new SortParagraphsContent(
      {
        paragraphs: this.params.paragraphs,
        addButtonsForMovement: this.params.behaviour.addButtonsForMovement,
        duplicatesInterchangeable: this.params.behaviour.duplicatesInterchangeable,
        penalties: this.params.behaviour.applyPenalties,
        scoringMode: this.params.behaviour.scoringMode,
        taskDescription: Util.stripHTML(this.params.taskDescription)
          .replace(/(\r\n|\n|\r)/gm, ' ')
          .replace(/\s{2}/g, ' ')
          .trim(),
        previousState: this.previousState,
        a11y: this.params.a11y,
        l10n: {
          up: this.params.l10n.up,
          down: this.params.l10n.down,
          disabled: this.params.l10n.disabled
        },
        viewStates: SortParagraphs.VIEW_STATES
      },
      {
        onInteracted: () => {
          this.handleInteracted();
        },
        read: (text) => {
          // Using H5P.Question to let screen reader read text
          this.read(text);
        }
      }
    );
  }

  /**
   * Register the DOM elements with H5P.Question
   */
  registerDomElements() {
    // Set optional media
    const media = this.params.media.type;
    if (media && media.library) {
      const type = media.library.split(' ')[0];
      // Image
      if (type === 'H5P.Image') {
        if (media.params.file) {
          this.setImage(media.params.file.path, {
            disableImageZooming: this.params.media.disableImageZooming,
            alt: media.params.alt,
            title: media.params.title,
            expandImage: media.params.expandImage,
            minimizeImage: media.params.minimizeImage
          });
        }
      }
      // Video
      else if (type === 'H5P.Video') {
        if (media.params.sources) {
          this.setVideo(media);
        }
      }
      // Audio
      else if (type === 'H5P.Audio') {
        if (media.params.files) {
          // Register task audio
          this.setAudio(media);
        }
      }
    }

    // Register task introduction text
    if (this.params.taskDescription) {
      const introduction = document.createElement('div');
      introduction.classList.add('h5p-sort-paragraphs-task-description');
      introduction.innerHTML = this.params.taskDescription;
      this.setIntroduction(introduction);
    }

    // Current user view
    this.setViewState('task');

    // Register content with H5P.Question
    this.setContent(this.content.getDOM());

    this.previousState = this.previousState ?? {};
    if (
      (
        this.previousState.viewState === SortParagraphs.VIEW_STATES['results'] ||
        this.previousState.viewState === SortParagraphs.VIEW_STATES['solutions']
      )
    ) {
      // Need to wait until DOM is ready for us
      H5P.externalDispatcher.on('initialized', () => {
        this.isExternalCall = true; // Prevent focussing
        if (this.previousState.viewState === SortParagraphs.VIEW_STATES['results']) {
          this.setViewState('results');
          this.checkAnswer();
        }
        else {
          this.setViewState('solutions');
          this.checkAnswer();
          this.hideButton('show-solution');
          this.showSolutions();
        }
        this.isExternalCall = false;
      });
    }
    else {
      this.previousState.viewState = SortParagraphs.VIEW_STATES['task'];
    }

    // Register Buttons
    this.addButtons();

    // Inform content about resize
    this.on('resize', () => {
      this.content.resize();
    });

    this.trigger('resize');
  }

  /**
   * Add all the buttons that shall be passed to H5P.Question.
   */
  addButtons() {
    // Check answer button
    this.addButton('check-answer', this.params.l10n.checkAnswer, () => {
      this.checkAnswer();
    }, true, {
      'aria-label': this.params.a11y.check
    }, {
      contentData: this.extras,
      textIfSubmitting: this.params.l10n.submitAnswer,
    });

    // Show solution button
    this.addButton('show-solution', this.params.l10n.showSolution, () => {
      this.hideButton('show-solution');
      this.showSolutions();
    }, false, {
      'aria-label': this.params.a11y.showSolution
    }, {});

    // Retry button
    this.addButton('try-again', this.params.l10n.tryAgain, () => {
      this.resetTask();
    }, false, {
      'aria-label': this.params.a11y.retry
    }, {});
  }

  /**
   * Check if result has been submitted or input has been given.
   * @returns {boolean} True, if answer was given.
   * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-1}
   */
  getAnswerGiven() {
    return this.content?.isAnswerGiven() || false;
  }

  /**
   * Get latest score.
   * @returns {number} latest score.
   * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-2}
   */
  getScore() {
    let score = 0;

    if (!this.content) {
      score = this.previousState?.score || 0;
    }
    else if (this.viewState === SortParagraphs.VIEW_STATES['solutions']) {
      score = this.currentScore || this.previousState?.score || 0;
    }
    else {
      score = (this.content.computeResults()).score;
    }

    this.currentScore = score;

    return score;
  }

  /**
   * Get maximum possible score.
   * @returns {number} Score necessary for mastering.
   * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-3}
   */
  getMaxScore() {
    const length = this.params.paragraphs.length;
    // For transitions mode, cound number of paragraph transitions
    return (this.params.behaviour.scoringMode === 'positions') ? length : length - 1;
  }

  /**
   * Show solutions.
   * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-4}
   */
  showSolutions() {
    this.setViewState('solutions');
    this.content.showSolutions({ skipFocus: this.isExternalCall });
    this.trigger('resize');
  }

  /**
   * Reset task.
   * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-5}
   */
  resetTask() {
    this.showButton('check-answer');
    this.hideButton('show-solution');
    this.hideButton('try-again');
    this.removeFeedback();
    this.content.reset();
    this.previousState = {};
    this.setViewState('task');
    this.trigger('resize');
  }

  /**
   * Get xAPI data.
   * @returns {object} XAPI statement.
   * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-6}
   */
  getXAPIData() {
    return { statement: this.getXAPIAnswerEvent().data.statement };
  }

  /**
   * Build xAPI answer event.
   * @returns {H5P.XAPIEvent} XAPI answer event.
   */
  getXAPIAnswerEvent() {
    const xAPIEvent = this.createXAPIEvent('answered');

    xAPIEvent.setScoredResult(this.getScore(), this.getMaxScore(), this,
      true, this.isPassed());

    xAPIEvent.data.statement.result.response = this.content.getDraggablesOrder().join('[,]');

    return xAPIEvent;
  }

  /**
   * Create an xAPI event.
   * @param {string} verb Short id of the verb we want to trigger.
   * @returns {H5P.XAPIEvent} Event template.
   */
  createXAPIEvent(verb) {
    const xAPIEvent = this.createXAPIEventTemplate(verb);
    Util.extend(
      xAPIEvent.getVerifiedStatementValue(['object', 'definition']),
      this.getxAPIDefinition());
    return xAPIEvent;
  }

  /**
   * Get the xAPI definition for the xAPI object.
   * @returns {object} XAPI definition.
   */
  getxAPIDefinition() {
    const definition = {};
    definition.name = {};
    definition.name[this.languageTag] = this.getTitle();
    // Fallback for h5p-php-reporting, expects en-US
    definition.name['en-US'] = definition.name[this.languageTag];
    definition.description = {};
    definition.description[this.languageTag] = Util.stripHTML(this.getDescription());
    // Fallback for h5p-php-reporting, expects en-US
    definition.description['en-US'] = definition.description[this.languageTag];
    definition.type = 'http://adlnet.gov/expapi/activities/cmi.interaction';
    definition.interactionType = 'sequencing';
    definition.correctResponsesPattern = [];
    this.params.paragraphs.forEach((paragraph, index) => {
      definition.correctResponsesPattern.push(index);
    });
    definition.correctResponsesPattern = [definition.correctResponsesPattern.join('[,]')];
    definition.choices = this.params.paragraphs.map((paragraph, index) => {
      paragraph = Util.stripHTML(paragraph);

      const choicesDescription = {};
      choicesDescription[this.languageTag] = paragraph;
      // Fallback for h5p-php-reporting, expects en-US
      choicesDescription['en-US'] = choicesDescription[this.languageTag];

      return {
        id: index,
        description: choicesDescription
      };
    });

    // Set extension
    definition.extensions = definition.extensions || {};
    if (this.content.options.scoringMode === 'transitions') {
      definition.extensions['https://h5p.org/x-api/sequencing-type'] = 'transitions';
    }

    if (this.content.options.duplicatesInterchangeable) {
      definition.extensions['https://h5p.org/x-api/duplicates-interchangeable'] = 1;
    }

    return definition;
  }

  /**
   * Check answer.
   */
  checkAnswer() {
    if (this.viewState === SortParagraphs.VIEW_STATES['task']) {
      // checkAnswer was not triggered to recreate previous state
      this.trigger(this.getXAPIAnswerEvent());

      this.storeH5PState();
    }

    this.setViewState('results');
    this.trigger('resize');

    const isExternalCall = this.isExternalCall;

    setTimeout(() => {
      this.content.disable();

      this.hideButton('check-answer');

      if (
        this.viewState !== SortParagraphs.VIEW_STATES['solutions'] &&
        this.params.behaviour.enableSolutionsButton &&
        this.getScore() !== this.getMaxScore()
      ) {
        this.showButton('show-solution');
      }

      if (this.params.behaviour.enableRetry) {
        this.showButton('try-again');
      }

      this.content.showResults({
        skipExplanation: this.viewState === SortParagraphs.VIEW_STATES['solutions'],
        skipFocus: isExternalCall
      });

      const score = this.getScore();
      const maxScore = this.getMaxScore();

      const textScore = H5P.Question.determineOverallFeedback(
        this.params.overallFeedback, score / maxScore);

      // Output via H5P.Question - expects :num and :total
      const ariaMessage = this.params.a11y.yourResult
        .replace('@score', ':num')
        .replace('@total', ':total');

      this.setFeedback(
        textScore.trim(),
        score,
        maxScore,
        ariaMessage
      );
    }, 0); // Prevent flickering when content resizes by button alignment
  }

  /**
   * Determine whether the task has been passed by the user.
   * @returns {boolean} True if user passed or task is not scored.
   */
  isPassed() {
    return this.getScore() >= this.getMaxScore();
  }

  /**
   * Get task title.
   * @returns {string} Title.
   */
  getTitle() {
    let raw;
    if (this.extras.metadata) {
      raw = this.extras.metadata.title;
    }
    raw = raw || SortParagraphs.DEFAULT_DESCRIPTION;

    // H5P Core function: createTitle
    return H5P.createTitle(raw);
  }

  /**
   * Get task description.
   * @returns {string} Description.
   */
  getDescription() {
    return this.params.taskDescription || SortParagraphs.DEFAULT_DESCRIPTION;
  }

  /**
   * Answer call to return the current state.
   * @returns {object|undefined} Current state.
   */
  getCurrentState() {
    /*
     * H5P integrations may (for instance) show a restart button if there is
     * a previous state set, so here not storing the state if no answer has been
     * given by the user and there's no order stored previously - preventing
     * to show up that restart button without the need to.
     */
    if (!this.getAnswerGiven() && !this.previousState.order) {
      return {};
    }

    return {
      order: this.content.getDraggablesOrder(),
      viewState: this.viewState,
      score: this.viewState === SortParagraphs.VIEW_STATES['task'] ?
        0 :
        this.getScore()
    };
  }

  /**
   * Handle user interacted.
   */
  handleInteracted() {
    this.triggerXAPI('interacted');
  }

  /**
   * Set view state.
   * @param {string|number} state State to be set.
   */
  setViewState(state) {
    if (
      typeof state === 'string' &&
      SortParagraphs.VIEW_STATES[state] !== undefined
    ) {
      this.viewState = SortParagraphs.VIEW_STATES[state];
    }
    else if (
      typeof state === 'number' &&
      Object.values(SortParagraphs.VIEW_STATES).includes(state)
    ) {
      this.viewState = state;

      this.content.setViewState(
        SortParagraphs.VIEW_STATES.find((value) => value === state).keys[0]
      );
    }
  }

  /**
   * Retrieve state provider to get current state from.
   * @returns {H5P.ContentType|null} Instance to get current state from.
   */
  retrieveStateProvider() {
    let stateProvider = this.isRoot() ? this : null;
    if (stateProvider) {
      return stateProvider;
    }
    // Find root instance for our subcontent instance
    const rootInstance = H5P.instances
      .find((instance) => instance.contentId === this.contentId);

    // Check root instance for having support for resume
    if (typeof rootInstance?.getCurrentState === 'function') {
      stateProvider = rootInstance;
    }

    return stateProvider;
  }

  /**
   * Store current state.
   *
   * Could be amended if required, of course, e.g. add an options
   * argument to control the 'deleteOnChange' value, add a callback
   * function to be passed to H5P.setUserData, etc.
   */
  storeH5PState() {
    if (!this.canStoreState) {
      return; // Server does not store state.
    }

    if (!this.stateProvider) {
      return; // No state provider available.
    }

    H5P.setUserData(
      this.contentId, // Set automatically by H5P core
      'state',
      this.stateProvider.getCurrentState(),
      { deleteOnChange: true } // Use default behavior of H5P core
    );
  }
}

/** @constant {string} */
SortParagraphs.DEFAULT_DESCRIPTION = 'SortParagraphs';

/** @constant {object} view states */
SortParagraphs.VIEW_STATES = { task: 0, results: 1, solutions: 2 };
