"use strict"; // Drupal Behaviors

(function ($, Drupal) {
  Drupal.behaviors.script = {
    attach: function attach(context, settings) {
      var elements = document.querySelectorAll('#parentCountry');

      for (var i = 0; i < elements.length - 1; i++) {
        elements[i].remove();
      }

      if ('#alt-edit--search'.length) {
        var search = GetParameterValues('search');

        if (search) {
          search = search.replace(/\+/g, ' ');
          var inputElement = document.getElementById('alt-edit--search');

          if (inputElement) {
            inputElement.value = decodeURIComponent(search);
          }
        }
      }

      var itemsPerPage = GetParameterValues('items_per_page');

      if (typeof itemsPerPage === 'undefined') {
        var itemsEl = document.getElementById('alt-edit--items-per-page');

        if (itemsEl) {
          itemsEl.value = '100';
        }
      }

      function GetParameterValues(param) {
        var url = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');

        for (var i = 0; i < url.length; i++) {
          var urlPar = url[i].split('=');

          if (urlPar[0] == param) {
            return urlPar[1];
          }
        }
      } // Target the specific form item and check if parentCountry already exists


      $('.js-form-item-field-mailing-geography', context).each(function () {
        var $formItem = $(this); // Check if parentCountry already exists to prevent duplicates

        if ($('#parentCountry').length > 0) {
          return;
        }

        var parentList = $('<select>');
        parentList.attr('id', 'parentCountry');
        parentList.append($('<option>', {
          value: '-1',
          text: 'Select Country'
        }));
        var mailStateSelect = '.js-form-item-field-mailing-geography .select-wrapper select.form-select';
        var currentParent = -1;
        $(mailStateSelect + ' option').each(function () {
          var optionValue = $(this).val();
          var optionText = $.trim($(this).text());

          if (optionText.startsWith("-")) {
            $(this).data('data-parent', currentParent);
            $(this).text($(this).text().replace("-", ""));
          } else {
            $(this).data('data-parent', "parent");

            if (optionValue != 'All') {
              parentList.append($('<option>', {
                value: optionValue,
                text: optionText
              }));
              currentParent = optionValue;
              $(this).remove();
            }
          }
        });
        var parentListLabel = $('<label>');
        parentListLabel.attr('for', 'parentCountry');
        parentListLabel.addClass('usa-label control-label');
        $formItem.prepend(parentList).prepend(parentListLabel);
        $(parentList).addClass("form-select usa-select");
        $('#parentCountry option:contains("United States of America")').insertAfter('#parentCountry option[value="-1"]');
        $(mailStateSelect).prop("disabled", true); // Use event delegation to handle dynamic content

        $(document).off('change.parentCountry', '#parentCountry').on('change.parentCountry', '#parentCountry', function () {
          var optionValue = $(this).val();

          if (optionValue != "-1") {
            console.log("x" + optionValue + "x");
            $(mailStateSelect + ' option').each(function () {
              var dataValue = $(this).data("data-parent");

              if (dataValue !== optionValue) {
                $(this).hide();
              } else {
                $(this).show();
              }
            });
            $(mailStateSelect).prop("disabled", false);
          } else {
            $(mailStateSelect).prop("disabled", true);
          }

          $(mailStateSelect + " option").val("All");
        });
      });
    }
  };
})(jQuery, Drupal);