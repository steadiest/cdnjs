#!/usr/bin/env node

/*
 * Fix the package.json of each lib.
 * If the minified file exists, filename field should point to it.
 *
 */

var fs = require("fs"),
    async = require("async"),
    glob = require("glob"),
    isThere = require("is-there");

var packages = glob.sync("./ajax/libs/*/package.json");

async.each(packages, function(item, callback) {
  var content = JSON.parse(fs.readFileSync(item, 'utf8'));
  delete content.devDependencies;
  delete content.scripts;
  delete content.install;
  fs.writeFileSync(item, JSON.stringify(content, null, 2) + '\n', 'utf8');
  callback();
});
