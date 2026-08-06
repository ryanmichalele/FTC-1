"use strict";

/**
 * @file
 * Theme Javascript file for the return to top button.
 */
(function ($) {
  $(window).scroll(function () {
    if ($(this).scrollTop() > 1000) {
      // Button hidden initially. See _footer.scss.
      $('.usa-footer__return-to-top').addClass('js-show');
    } else {
      $('.usa-footer__return-to-top').removeClass('js-show');
    }
  });
})(jQuery, Drupal);