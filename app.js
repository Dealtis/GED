var chokidar = require('chokidar');
var DecompressZip = require('decompress-zip');
const fs = require('fs');
var conn = require('./conn');
var sock = require('./server');
var _ = require('lodash');
var exec = require('child_process').exec,
    child;
var traitement = require('./traitement');
var request = require('request');
var async = require('async');
var CronJob = require('cron').CronJob;



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

try {
    watcher.on('add', (path) => {
            if (_.endsWith(path, '.zip')) {
                deZip(path);
            }
            if (_.endsWith(path, '.pdf')) {
                if (!(_.endsWith(path, '_tr.pdf') || _.endsWith(path, '_err.pdf'))) {
                    splitPdf(path);
                }
            }
            if (_.endsWith(path, '.jpg') || _.endsWith(path, '.JPG') || _.endsWith(path, '.JPEG') || _.endsWith(path, '.tif')) {
                if (_.endsWith(path, '_tr.jpg') || _.endsWith(path, '_tr.JPG')) {} else {
                    splitJpg(path);
                }
            }
        })
        .on('unlink', (path) => {
            if (_.endsWith(path, '.zip')) {
                var pathSplit = path.split('\\');
                setTimeout(function() {
                    function full_tr_func(pathSplit) {
                        fs.readdir(pathSplit[0] + '/' + pathSplit[1] + '/', function(err, data) {
                            if (err) {
                                console.log("readir" + err);
                            }
                            var soc = pathSplit[1];

                            //search if trait exist
                            var schtrait = _.find(traitementList, {
                                'soc': soc
                            });
                            //console.log(schtrait);
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
                    full_tr_func(pathSplit);
                }, 8000);
            }
        });
} catch (e) {
    console.log(e);
    console.log("Erreur sur watch file");
}

function scan_tr(pathSplit) {
    fs.readdir(pathSplit[0] + '/' + pathSplit[1] + '/', function(err, data) {
        if (err) {
            console.log("readir" + err);
        }
        var full_tr = true;
        var filename;
        var extension;
        var soc = pathSplit[1];
        var BreakException = {};

        try {
            data.forEach(function(entry) {
                filename = entry.substring(0, entry.length - 4);
                extension = entry.slice(-3);
                if (!(_.endsWith(entry, '_err.' + extension))) {
                    if (!(_.endsWith(entry, '_tr.' + extension))) {
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
    var supptrait = _.remove(traitementList, function(n) {
        return n.soc == societe;
    });
    console.log("Fin traitement :" + societe);
}

function deZip(path) {
    try {
        var pathSplit = path.split('\\');
        var filename = pathSplit[2];
        fs.readFile(path, (err, data) => {
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
                    console.log(err);
                    debugger;
                });
                unzipper.on('extract', function(log) {
                    console.log('Finished extracting');
                    fs.rename(path, "archive/" + pathSplit[1] + "/zip/" + filename, function(err, stdout, stderr) {
                        if (err) {
                            throw err;
                        }
                        console.log("Archive success");
                    })
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
};

function splitPdf(path) {
    var pathSplit = path.split('\\');
    var filename = pathSplit[2].substring(0, pathSplit[2].length - 4);
    var extension = pathSplit[2].slice(-3);
    exec('pdftk ' + path + ' burst output ' + pathSplit[0] + '/' + pathSplit[1] + '/' + filename + '_%02d_tr.' + extension,
        function(error, stdout, stderr) {
            if (error != null) {
                console.log("err was throw" + error);
                var pos = {
                    "filename": filename + '.' + extension,
                    "societe": pathSplit[1],
                    "statut": "danger",
                    "datetrait": Date.now()
                };
                sock.majTrait(pos);
                fs.rename(pathSplit[0] + '/' + pathSplit[1] + '/' + filename + '.' + extension, 'erreur/' + pathSplit[1] + '/' + filename + '_err.' + extension, function(err) {
                    if (err) {
                        console.log(err);
                        //throw err;
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
                    connection.query('INSERT INTO ged_erreur (filename, zipfile, societe, errCode, dateerreur) VALUES (?, ?, ?, ?, ?)', [filename + '_err.' + extension, zip, pathSplit[1], "pdftk", date], function(err, result) {
                        if (err) {
                            console.log(err);
                        }
                        sock.sendErrorMsg(pathSplit[1], "pdftk");
                    });
                    connection.release();
                });
            } else {
                setTimeout(function() {
                    fs.unlink(path, (err) => {

                        if (err) {
                            debugger;
                            throw err;
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
            exec('convert ' + pathSplit[0] + '/' + pathSplit[1] + '/' + filename + '.' + extension + ' -quality 100 ' + pathSplit[0] + '/' + pathSplit[1] + '/' + filename + '_tr.jpg', function(error, stdout, stderr) {
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




//new CronJob('0 */1 * * * *', function() {
console.log("DL START");
conn.pool.getConnection(function(err, connection) {
    // connected! (unless `err` is set)

    connection.query('select CODEDI from ged_import where NOTOK = 0 GROUP BY CODEDI',
        function(err, rowsoc, fields) {
            if (err) {
                console.log(err.code);
                throw err;
            }

            async.eachSeries(rowsoc, function(soc, callback) {

                console.log(soc.CODEDI);
                connection.query("select * from ged_import where NOTOK = 0 AND CODEDI = '" + soc.CODEDI + "'",
                    function(err, rows, fields) {
                        if (err) {
                            console.log(err.code);
                            throw err;
                        }
                        async.eachSeries(rows, function(row, callback) {
                            var download = function(uri, filename, callback) {
                                request.head(uri, function(err, res, body) {
                                    try {
                                        switch (res.headers['content-type']) {
                                            case "image/jpeg":
                                                filenameFormat = filename + ".jpg";
                                                break;
                                            case "image/tiff":
                                                filenameFormat = filename + ".tif";
                                                break;
                                            case "image/gif":
                                                filenameFormat = filename + ".gif";
                                                break;
                                            case "image/png":
                                                filenameFormat = filename + ".png";
                                                break;
                                            case "application/pdf":
                                                filenameFormat = filename + ".pdf";
                                                break;
                                            default:
                                        }
                                        //TODO handle error
                                        request(uri).pipe(fs.createWriteStream(filenameFormat)).on('close', callback);
                                    } catch (e) {
                                        //console.log(e);
                                    }
                                });
                            };
                            //NUMEQUINOXE, URL_EQUINOXE, CODEDI, NOTOK
                            download(row.URL_EQUINOXE, 'dl/' + row.NUMEQUINOXE + '_' + row.CODEDI, function() {
                                console.log('done');
                                callback();
                                //insert database get info ???

                                connection.query('INSERT INTO ged_doc (numequinoxe, numdoc, societe, CODEDI, datescan, remettant, doc) VALUES (?, ?, ?, ? ,? ,? ,?)', [item.numequinoxe, item.numdoc, item.societe, item.CODEDI, date, item.remettant, JSON.stringify(item.doc)], function(err, result) {
                                    if (err) {
                                        console.log(err);
                                    }
                                    sock.sendErrorMsg(soc, "noBarcode");
                                });
                            });
                        }, function(err) {
                            if (err) {
                                console.log('A file failed to process');
                            } else {
                                console.log('All files have been processed successfully');
                                callback();
                            }
                        });
                    });
            }, function(err) {
                if (err) {
                    console.log('A file failed to process');
                } else {
                    console.log('All society have been processed successfully');
                }
            });
            connection.release();
        });
});

function elloo() {

};





//}, null, false, 'Europe/Paris');
