"use strict";

var assert = require("assert"),
    path = require("path"),
    fs = require("fs"),
    glob = require("glob"),
    vows = require("vows-si"),
    jsv = require("JSV").JSV.createEnvironment(),
    isThere = require("is-there");

function parse(json_file, ignore_missing, ignore_parse_fail) {
    var content;

    try {
        content = fs.readFileSync(json_file, 'utf8');
    } catch (err1) {
        if (!ignore_missing) {
            assert.ok(0, json_file + " doesn't exist!");
        }
        return null;
    }
    try {
        return JSON.parse(content);
    } catch (err2) {
        if (!ignore_parse_fail) {
            assert.ok(0, json_file + " failed to parse, you can validate your json here: http://jsonlint.com/");
        }
        return null;
    }
}

function pkg_name(json_file) {
    return json_file.split("/")[3];
}

function pretty_error(err) {
    return err.message + " (" + err.details + "): " +
        err.schemaUri.split("#")[1];
}

// load up those files
var packages = glob.sync("./ajax/libs/*/").map(function (pkg) {
        return pkg + "package.json";
    }),
    schemata = glob.sync("./test/schemata/*.json").map(function (schema) {
        return jsv.createSchema(parse(schema));
    }),
    suite = vows.describe('Package structure');

packages.map(function (pkg) {
    var package_vows = {"topic": pkg},
        pname = pkg_name(pkg),
        context = {};
    package_vows[pname + " has package.json"] = function (pkg) {
        assert.ok(isThere(pkg), pkg_name(pkg) + " missing!");
    };
    package_vows[pname + " package.json is well-formed"] = function (pkg) {
        assert.ok(parse(pkg, true),
            pkg_name(pkg) + " malformed!");
    };
    package_vows[pname + " package.json is valid"] = function (pkg) {
        var pkg_obj = parse(pkg, true, true),
            valid = false,
            errors;
        if (pkg_obj === null) {
            // we already know about the problem
            return;
        }
        errors = schemata.map(function (schema) {
            var schema_errors = schema.validate(pkg_obj).errors;
            if (!schema_errors.length) {
                valid = true;
            } else {
                return {
                    name: schema._attributes.name,
                    errors: schema_errors
                };
            }
            return null;
        });
        if (!valid) {
            assert.ok(valid,
                [pkg_name(pkg) + " is not a valid cdnjs package.json format:"].concat(
                    errors
                        .filter(function (schema) {
                            return schema !== null;
                        })
                        .map(function (schema) {
                            return "\t  » " + schema.name +
                                "\n\t\t" +
                                schema.errors.map(pretty_error).join("\n\t\t");
                        })
                )
                .join("\n"));
        }
    };
    package_vows[pname + ": filename from package.json exists"] = function (pkg) {
        var json = parse(pkg, true, true);
        var filePath = "./ajax/libs/" + json.name + "/"+ json.version
            + "/" + json.filename;
        assert.ok(isThere(filePath),
                  filePath +" does not exist but is referenced in package.json!");
    };
    package_vows[pname + ": required file exist"] = function (pkg) {
      var json = parse(pkg, true, true);
      if (json.requiredFiles !== undefined) {
        for (var i in json.requiredFiles) {
          var filePath = "./ajax/libs/" + json.name + "/"+ json.version + "/" + json.requiredFiles[i];
          assert.ok(isThere(filePath), filePath +" does not exist but is required!");
        }
      }
    };
    package_vows[pname + ": name in package.json should be parent folder name"] = function (pkg) {
        var json = parse(pkg, true, true);
        var dirs = pkg.split("/");
        var trueName = dirs[dirs.length - 2];
        assert.ok(trueName == json.name,
            pkg_name(pkg) + ": Name property should be '" + trueName + "', not '" + json.name +"'");
    };

    var targetPrefixes = new RegExp("^git://.+\.git$");
    package_vows[pname + ": autoupdate block is valid (if present)"] = function (pkg) {
        var json = parse(pkg, true, true),
            fileMapPostfixes = new RegExp("\\*\\*$");
        if (json.autoupdate) {
            assert.ok(json.autoupdate.source == "git",
                pkg_name(pkg) + ": Autoupdate source should be 'git', not " + json.autoupdate.source);
            assert.ok(targetPrefixes.test(json.autoupdate.target),
                pkg_name(pkg) + ": Autoupdate target should match '" + targetPrefixes +
                "', but is " + json.autoupdate.target);
            for (var i in json.autoupdate.files) {
                assert.ok(!fileMapPostfixes.test(json.autoupdate.files[i]),
                    pkg_name(pkg) + ": fileMap should not end with ***");
            }

        } else if (json.npmFileMap) {
            for (var i in json.npmFileMap) {
                for (var j in json.npmFileMap[i].files) {
                    assert.ok(!fileMapPostfixes.test(json.npmFileMap[i].files[j]),
                        pkg_name(pkg) + ": fileMap should not end with ***");
                }
            }
        }
    }
    package_vows[pname + ": should not have both multiple auto-update configs"] = function(pkg) {
        var json = parse(pkg, true, true);
        assert.ok(json.autoupdate === undefined || json.npmFileMap === undefined,
            pkg_name(pkg) + ": has both git and npm auto-update config, should remove one of it");
    }
    package_vows[pname + ": should point filename field to minified file"] = function (pkg) {
        var json = parse(pkg, true, true);
        if (json.filename) {
            var path = "./ajax/libs/" + json.name + "/"+ json.version + "/",
                orig = json.filename.split("."),
                min = '';
            if (orig[orig.length - 2] !== 'min') {
                var temp = orig,
                    ext = temp.pop();
                temp.push("min");
                temp.push(ext);
                min = temp.join(".");
            }
            assert.ok(min === '' || !isThere(path + min),
                pkg_name(pkg) + ": filename field in package.json should point filename field to minified file.");
        }
    }

    package_vows[pname + ": format check"] = function (pkg) {
        var orig = fs.readFileSync(pkg, 'utf8'),
            correct = JSON.stringify(JSON.parse(orig), null, 2) + '\n';
        assert.ok(orig === correct,
            pkg_name(pkg) + ": package.json wrong format, correct one should be like this.\n(Remove the first 2 spaces of each line and include blank line at end if you copy and paste this example)\n" + correct +"\n");
    }

    package_vows[pname + ": useless fields check"] = function (pkg) {
        var json = parse(pkg, true, true);
        assert.ok(json.scripts === undefined && json.devDependencies === undefined,
            pkg_name(pkg) + ": we don't need scripts and devDependencies fields in package.json");
    }
    context[pname] = package_vows;
    suite.addBatch(context);
});

suite.export(module);
