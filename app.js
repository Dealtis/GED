var chokidar = require('chokidar');
var DecompressZip = require('decompress-zip');
var fs = require('fs'),
    path = require('path');
var conn = require('./conn');
var sock = require('./server');
var _ = require('lodash');
var exec = require('child_process').exec;
var traitement = require('./traitement');
var console = process.console;


//watcher
var watcher = chokidar.watch('reception', {
    ignored: [
        '*_tr.pdf',
        '*/*/b_tr.pdf/*'
    ],
    persistent: true,
    awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100
    }
});

//array traitement
var traitementList = [];
// export it
exports.traitementList = traitementList;

try {
    watcher.on('add', (path) => {
            if (_.endsWith(path, '.zip')) {
                deZip(path);
            }
            if (_.endsWith(path, '.pdf')) {
                if (!(_.includes(path, '_tr') || _.endsWith(path, '_err.pdf'))) {
                    splitPdf(path);
                }
            }
            if (_.endsWith(path, '.jpg') || _.endsWith(path, '.JPG') || _.endsWith(path, '.JPEG') || _.endsWith(path, '.tif')) {
                if (!(_.endsWith(path, '_tr.jpg') || _.includes(path, '_tr'))) {
                    splitJpg(path);
                }
            }
        })
        .on('unlink', (path) => {
            if (_.endsWith(path, '.zip')) {
                var pathSplit = path.split('\\');
                setTimeout(function() {
                    full_tr_func(pathSplit);
                }, 8000);
            }
        });
} catch (e) {
    console.log(e);
    console.log("Erreur sur watch file");
}

function full_tr_func(pathSplit) {
    fs.readdir(pathSplit[0] + '/' + pathSplit[1] + '/', function(err) {
        if (err) {
            console.log("readir" + err);
        }
        var soc = pathSplit[1];

        //search if trait exist
        var schtrait = _.find(traitementList, {
            'soc': soc
        });
        if (schtrait == undefined) {
            //push array traitement
            var addtrait = {
                'soc': soc,
                'zips': [{
                    "zipname": pathSplit[2]
                }]
            };
            traitementList.push(addtrait);
            scan_tr(pathSplit);
        } else {
            //add zip to traitement
            schtrait.zips.push({
                "zipname": pathSplit[2]
            });
        }
    });
}

function getDirectories(srcpath) {
    return fs.readdirSync(srcpath).filter(function(file) {
        return fs.statSync(path.join(srcpath, file)).isDirectory();
    });
}

exports.onRestart = function() {
    //check if there is file to trait
    var listDirectories = getDirectories("reception");
    listDirectories.forEach(function(societe) {
        fs.readdir(`reception/${societe}`, (err, files) => {
            if (files.length > 0) {
                console.log(`${societe} got files`);
                var path = `reception\\${societe}`;
                var pathSplit = path.split('\\');
                full_tr_func(pathSplit);
            }
        })
    });
}

function scan_tr(pathSplit) {
    fs.readdir(pathSplit[0] + '/' + pathSplit[1] + '/', function(err, data) {
        if (err) {
            console.log("readir" + err);
        }
        var full_tr = true;
        var soc = pathSplit[1];
        var BreakException = {};

        try {
            data.forEach(function(entry) {
                var extension = entry.slice(-3);
                if (!(_.endsWith(entry, '_err.' + extension))) {
                    if (!(_.includes(entry, '_tr'))) {
                        full_tr = false;
                    }
                } else {
                    full_tr = false;
                    throw BreakException;
                }
            });
            if (full_tr) {
                traitement.trait(data, soc, pathSplit[0] + '/' + pathSplit[1] + '/');
            } else {
                setTimeout(function() {
                    scan_tr(pathSplit)
                }, 2000);
            }
        } catch (e) {
            if (e !== BreakException) throw e;
        }
    });
}

exports.end_traitement = function(societe) {
    _.remove(traitementList, function(n) {
        return n.soc == societe;
    });
    console.info("Fin traitement :" + societe);
}

function deZip(path) {
    try {
        var pathSplit = path.split('\\');
        var filename = pathSplit[2];
        fs.readFile(path, (err) => {
            if (err) {
                if (err == "EBUSY") {
                    setTimeout(function() {
                        deZip(path);
                    }, 500);
                } else {
                    throw err;
                }
            } else {
                var unzipper = new DecompressZip(path)
                unzipper.on('error', function(err) {
                    console.log('Caught an error');
                    console.log(err + path);
                });
                unzipper.on('extract', function() {
                    console.log('Finished extracting');
                    fs.mkdir("archive/" + pathSplit[1], function(e) {
                        if (!e || (e && e.code === 'EEXIST')) {
                            fs.mkdir("archive/" + pathSplit[1] + "/zip", function(e) {
                                if (!e || (e && e.code === 'EEXIST')) {
                                    fs.rename(path, "archive/" + pathSplit[1] + "/zip/" + filename, function(err) {
                                        if (err) {
                                            throw err;
                                        }
                                        console.log("Archive success");
                                    })
                                } else {
                                    //debug
                                    console.error(e);
                                }
                            });
                        } else {
                            //debug
                            console.error(e);
                        }
                    });

                });
                unzipper.on('progress', function(fileIndex, fileCount) {
                    console.log('Extracted file ' + (fileIndex + 1) + ' of ' + fileCount);
                });
                var pathSplit = path.split('\\');
                unzipper.extract({
                    path: '' + pathSplit[0] + '/' + pathSplit[1] + ''
                });
            }
        });

    } catch (e) {
        console.log(e);
        if (e.code === "EBUSY") {
            setTimeout(function() {
                deZip(path)
            }, 3000);
        }
    }
}

function splitPdf(path) {
    var pathSplit = path.split('\\');
    var filename = pathSplit[2].substring(0, pathSplit[2].length - 4);
    var extension = pathSplit[2].slice(-3);
    exec('pdftk ' + path + ' burst output ' + pathSplit[0] + '/' + pathSplit[1] + '/' + filename + '_%02d_tr.' + extension,
        function(error) {
            if (error != null) {
                console.error(error);
                var pos = {
                    "filename": filename + '.' + extension,
                    "societe": pathSplit[1],
                    "statut": "danger",
                    "datetrait": Date.now()
                };
                sock.majTrait(pos);
                fs.rename(pathSplit[0] + '/' + pathSplit[1] + '/' + filename + '.' + extension, 'erreur/' + pathSplit[1] + '/' + filename + '_err.' + extension, function(err) {
                    if (err) {
                        console.error(err);
                    }
                })
                conn.pool.getConnection(function(err, connection) {
                    console.log(traitementList);

                    var schtrait = _.find(traitementList, {
                        'soc': pathSplit[1]
                    });

                    console.log(schtrait);
                    var zip = "";
                    if (schtrait != undefined) {
                        schtrait.zips.forEach(function(item) {
                            zip = zip + ", " + item.zipname
                        });
                    } else {
                        zip = "undefined";
                    }
                    var date = new Date().toISOString().slice(0, 19).replace('T', ' ');
                    connection.query('INSERT INTO ged_erreur (filename, zipfile, societe, errCode, dateerreur) VALUES (?, ?, ?, ?, ?)', [filename + '_err.' + extension, zip, pathSplit[1], "pdftk", date], function(err) {
                        if (err) {
                            console.error(err);
                        }
                        sock.sendErrorMsg(pathSplit[1], "pdftk", err);
                    });
                    connection.release();
                });
            } else {
                setTimeout(function() {
                    fs.unlink(path, (err) => {
                        if (err) {
                            console.error(err);
                        }
                    });
                }, 300);
            }
        });
}

function splitJpg(path) {
    if (path.indexOf("JPEG") > -1) {
        var pathSplit = path.split('\\');
        var filename = pathSplit[2].substring(0, pathSplit[2].length - 5);
        var extension = pathSplit[2].slice(-4);

        fs.rename(pathSplit[0] + '/' + pathSplit[1] + '/' + filename + '.' + extension, pathSplit[0] + '/' + pathSplit[1] + '/' + filename + '_tr.jpg', function(err) {
            if (err) {
                console.log(err);
                throw err;
            }
        })
    } else {
        var pathSplit = path.split('\\');
        var filename = pathSplit[2].substring(0, pathSplit[2].length - 4);
        var extension = pathSplit[2].slice(-3);
        if (path.indexOf("tif")) {
            exec('convert ' + pathSplit[0] + '/' + pathSplit[1] + '/' + filename + '.' + extension + ' -quality 100 ' + pathSplit[0] + '/' + pathSplit[1] + '/' + filename + '_tr.jpg', function(error) {
                if (error) throw error;
                fs.unlink(path, (err) => {
                    if (err) throw err;
                });
            });
        } else {

            fs.rename(pathSplit[0] + '/' + pathSplit[1] + '/' + filename + '.' + extension, pathSplit[0] + '/' + pathSplit[1] + '/' + filename + '_tr.jpg', function(err) {
                if (err) {
                    console.log(err);
                    throw err;
                }
            })
        }
    }
}
