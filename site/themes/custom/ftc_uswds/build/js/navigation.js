"use strict";

/**
 * @file
 * Theme Javascript file for initializing scripts.
 */
// Prevent dropdown menu collapse on click.
var dropdownMenu = document.querySelectorAll('.dropdown-menu');

if (dropdownMenu.length) {
  for (var i = 0; i < dropdownMenu.length; i++) {
    dropdownMenu[i].addEventListener('click', function (e) {
      e.stopPropagation();
    });
  }
}