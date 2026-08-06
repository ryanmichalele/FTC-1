"use strict";

/**
 * @file
 * Theme Javascript file for initializing interactive view filters.
 */
(function ($, Drupal) {
  Drupal.behaviors.viewFilters = {
    attach: function attach(context, settings) {
      var $viewFormRN = $('.rn-search form.views-exposed-form.bef-exposed-form', context); // Display applied filters in the view header when selected.

      var $viewForm = $('form.views-exposed-form.bef-exposed-form', context);

      if ($viewFormRN.length) {
        var $viewFormContent = $('.form__content', $viewFormRN);
        var $viewFilterContainers = $('.rn-search form.views-exposed-form.bef-exposed-form fieldset.group-filters .form-item');
        var $resetButton = $('input[data-drupal-selector="edit-reset-rn"]', $viewFormRN);
        var $selectedOptions = $('.view--page .view-header .applied-filters', context);
        var activeFilters = [];

        if ($viewFilterContainers.length && $selectedOptions.length) {
          $viewFilterContainers.each(function () {
            if ($(this).hasClass('form-type-select') || $(this).hasClass('form-type-textfield')) {
              var viewFilterText = '';
              var labelText = '';
              labelText = $(this).find('label').text();
              labelText = labelText.replace('AddressCity', 'City');
              var viewFilterLabel = '<strong>' + labelText + '</strong>: ';

              if ($(this).hasClass('form-type-select')) {
                var selectedValue = $(this).find('option:selected').val();

                if (selectedValue != 'All' && selectedValue != "-1") {
                  viewFilterText = $(this).find('option:selected').text();
                }
              } else if ($(this).hasClass('form-type-textfield')) {
                if ($(this).find('input[type="text"]').val()) {
                  // The textbox has a value
                  viewFilterText = $(this).find('input[type="text"]').val();
                }
              }

              if (viewFilterText != '') {
                viewFilterText = viewFilterLabel + viewFilterText;
              }

              if (viewFilterText) {
                activeFilters.push(viewFilterText);
              }
            } else if ($(this).is('fieldset')) {
              labelText = $(this).find('legend span.fieldset-legend').text();
              var viewFilterLabel = '<strong>' + labelText + '</strong>: ';
              var $viewFilters = $(this).find('option[selected]:not([value="All"]), input[type="checkbox"]:checked', $viewFormContent);

              if ($viewFilters.length && $selectedOptions.length) {
                var i = 0;
                $viewFilters.each(function () {
                  if ($(this).is('option')) {
                    viewFilterText = $(this).text();
                  } else if ($(this).is('input:checkbox')) {
                    viewFilterText = $(this).next('label').text();
                  }

                  if (i == 0 && viewFilterText != '') {
                    viewFilterText = viewFilterLabel + viewFilterText;
                  }

                  if (viewFilterText) {
                    activeFilters.push(viewFilterText);
                  }

                  i++;
                });
              }
            }
          });

          if (activeFilters.length) {
            var activeFilterText = activeFilters.join(', ');
            console.log(activeFilterText);
            activeFilterText = activeFilterText.replace(/, </g, ' <');
            console.log(activeFilterText);
            var textContent = '<div class="applied-filters--heading"><span class="style-as-h2">Filters Applied</span> <a href="#" id="js-clear-filters">Reset Filters</a></div><div class="applied-filters--content"><p><span>' + activeFilterText + '</span></p></div>';
            $selectedOptions.html(textContent);
          }
        } // Attach items per page behavior to view filter.


        var $pageItems = $('select#alt-edit--items-per-page', context);

        if ($pageItems.length) {
          $pageItems.on('change', function (e) {
            e.preventDefault();
            $('select[name="items_per_page"]', $viewForm).val($pageItems.val());
            $viewFormRN.submit();
          });
        }

        $('a#js-clear-filters').on('click', function (e) {
          e.preventDefault();
          $resetButton.trigger('click');
        });
      } else if ($viewForm.length) {
        var _$viewFormContent = $('.form__content', $viewForm);

        var $viewFilters = $('option[selected]:not([value="All"]), input[type="checkbox"]:checked', _$viewFormContent);

        var _$resetButton = $('input[data-drupal-selector="edit-reset"]', $viewForm);

        var _$selectedOptions = $('.view--page .view-header .applied-filters', context);

        var _activeFilters = [];

        if ($viewFilters.length && _$selectedOptions.length) {
          $viewFilters.each(function () {
            if ($(this).is('option')) {
              _activeFilters.push($(this).text());
            } else if ($(this).is('input:checkbox')) {
              _activeFilters.push($(this).next('label').text());
            }
          });

          if (_activeFilters.length) {
            var _textContent = '<div class="applied-filters--heading"><span class="style-as-h2">Filters Applied</span> <a href="#" id="js-clear-filters">Reset Filters</a></div><div class="applied-filters--content"><p><span>' + _activeFilters.join(', ') + '</span></p></div>';

            _$selectedOptions.html(_textContent);
          }

          $('a#js-clear-filters').on('click', function (e) {
            e.preventDefault();

            _$resetButton.trigger('click');
          });
        } // Attach items per page behavior to view filter.


        var _$pageItems = $('select#alt-edit--items-per-page', context);

        if (_$pageItems.length) {
          _$pageItems.on('change', function (e) {
            e.preventDefault();
            $('select[name="items_per_page"]', $viewForm).val(_$pageItems.val());
            $viewForm.submit();
          });
        } // Attach sort by behavior to view filter.


        var $sortBy = $('select#alt-edit--sort', context);

        if ($sortBy.length) {
          $sortBy.on('change', function (e) {
            e.preventDefault();
            $('select[name="sort_by"]', $viewForm).val($sortBy.val());
            $viewForm.submit();
          });
        } // Mission Conditional filters
        // Competition Topics


        var $compItem = $('input[name="field_mission[30]"]', context);
        var $compTopics = $('.form-item-field-competition-topics', context);

        if ($compItem.length && $compTopics.length) {
          if (!$compItem.is(':checked')) {
            $compTopics.attr('hidden', '');
          }

          $compItem.on('change', function (e) {
            if ($(this).is(':checked')) {
              $compTopics.removeAttr('hidden');
            } else {
              $compTopics.attr('hidden', '').find('select[name="field_competition_topics"]').val('All');
              ;
            }
          });
        } // Consumer Topics


        var $consItem = $('input[name="field_mission[29]"]', context);
        var $consTopics = $('.form-item-field-consumer-protection-topics', context);

        if ($consItem.length && $consTopics.length) {
          if (!$consItem.is(':checked')) {
            $consTopics.attr('hidden', '');
          }

          $consItem.on('change', function (e) {
            if ($(this).is(':checked')) {
              $consTopics.removeAttr('hidden');
            } else {
              $consTopics.attr('hidden', '').find('select[name="field_consumer_protection_topics"]').val('All');
            }
          });
        } // Nested checkbox behavior


        var $nestedCheckboxes = $('.form-checkboxes.bef-nested', context);
        $('ul.checkbox-list--nested', $nestedCheckboxes).parent().addClass('checkbox-list--parent');
        var $parentCheckboxes = $('li.checkbox-list--parent > .form-item > input[type="checkbox"]');

        if ($parentCheckboxes.length) {
          $parentCheckboxes.each(function () {
            if (!$(this).is(':checked')) {
              $(this).parent().siblings('ul.checkbox-list--nested').attr('hidden', '');
            }
          });
          $parentCheckboxes.on('change', function () {
            if (!$(this).is(':checked')) {
              $(this).parent().siblings('ul.checkbox-list--nested').attr('hidden', '').find('input[type="checkbox"]').prop('checked', false);
            } else {
              $(this).parent().siblings('ul.checkbox-list--nested').removeAttr('hidden');
            }
          });
        }
      }
    }
  };
})(jQuery, Drupal);