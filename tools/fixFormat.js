#!/usr/bin/env node

/*
 * Fix the format and indent of package.json of each lib.
 *
 */

var fs = require("fs"),
  async = require("async"),
  glob = require("glob"),
  packages = glob.sync("./ajax/libs/*/package.json");

async.each(packages, function(item, callback) {
  fs.writeFileSync(item, JSON.stringify(JSON.parse(fs.readFileSync(item, 'utf8')), null, 2) + '\n', 'utf8');
  callback();
});
