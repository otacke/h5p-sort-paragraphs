import '@styles/h5p-sort-paragraphs-separator.scss';

export default class SortParagraphsSeparator {
  /**
   * @class
   */
  constructor() {
    // Build content
    this.content = this.buildSeparator();
  }

  /**
   * Return the DOM for this class.
   * @returns {HTMLElement} DOM for this class.
   */
  getDOM() {
    return this.content;
  }

  /**
   * Build separator.
   * @returns {HTMLElement} Separator.
   */
  buildSeparator() {
    const separator = document.createElement('div');
    separator.classList.add('h5p-sort-paragraphs-separator');
    return separator;
  }

  /**
   * Show seperator.
   */
  show() {
    this.content.classList.remove('h5p-sort-paragraphs-no-display');
  }

  /**
   * Hide seperator.
   */
  hide() {
    this.content.classList.add('h5p-sort-paragraphs-no-display');
  }

  /**
   * Toggle CSS class named after an effect.
   * @param {string} effectName Effect name.
   * @param {boolean} enabled If true, effect will be set, else unset.
   */
  toggleEffect(effectName, enabled) {
    const effects = ['correct', 'wrong']; // Allowed effects
    if (typeof enabled !== 'boolean' || effects.indexOf(effectName) === -1) {
      return;
    }

    this.content.classList.toggle(`h5p-sort-paragraphs-${effectName}`, enabled);
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
   * @param {HTMLElement} scoreExplanation H5P Question score explanation.
   */
  showScoreExplanation(scoreExplanation) {
    if (this.scoreExplanation) {
      return; // Skip, already contains score explanation
    }

    this.scoreExplanation = scoreExplanation;
    this.content.appendChild(scoreExplanation);
  }

  /**
   * Remove H5P Question score explanation.
   */
  hideScoreExplanation() {
    /*
     * Keep reference instead of querying DOM, because H5P.Question.ScorePoints
     * may or may not wrap the score element in a container depending on version.
     */
    this.scoreExplanation?.remove();
    delete this.scoreExplanation;
  }
}
