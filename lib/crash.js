"use strict";

/*
This module is exists to help detect when multiple modules in the same process
require autocluster.
*/

var savedParentFilename;
module.exports = function (parentFilename) {
  if(savedParentFilename && savedParentFilename !== parentFilename) {
    throw new Error("More than one module from the same process requires autocluster: ", savedParentFilename, parentFilename);
  }
  savedParentFilename = parentFilename;
};
