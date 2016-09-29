var async = require('async');
var _ = require('lodash');
var Client = require('ftp');
const fs = require('fs');
var CronJob = require('cron').CronJob;
var exec = require('child_process').exec,
    child;

var request = require('request');

var conn = require('./conn');
var sock = require('./server');
var endtrait = require('./app');
//societe
var societe = [];
var console = process.console;
conn.pool.getConnection(function(err, connection) {
    // connected! (unless `err` is set)
    connection.query('select * from ged_societe',
        function(err, rows, fields) {
            if (err) {
                console.log(err.code);
                throw err;
            }
            rows.forEach(function(row) {
                    var addsociete = {
                        "societe": row.societe_name,
                        "CODEDI": row.societe_CODEDI,
                        "NEIF": row.societe_NEIF
                    };
                    societe.push(addsociete);
                })
                //console.log(societe);
            connection.release();
        });
});

exports.trait = function(liste, soc, path) {
    console.info("Lancement du traitement de " + soc);
    // Array to hold async tasks
    var asyncTasks = [];
    // Loop through some items
    liste.forEach(function(entry) {
        asyncTasks.push(function(callback) {
            var filename = entry.substring(0, entry.length - 4);
            var extension = entry.slice(-3);
            var s = _.find(societe, {
                'societe': soc
            });
            var traitFichierCallback = function(err, pos) {
                if (err) throw err;
                //lecture du code#
                var barcodeCallback = function(error, stdout, stderr) {
                    //if error retry
                    if (error) {
                        setTimeout(function() {
                            exec('php barcodereader.php ' + path + filename + '.jpg', barcodeCallback);
                        }, 1000);
                        console.error(error);
                        //callback(null);
                    } else {
                        var trimstdout = _.trim(stdout);
                        //console.log(trimstdout);
                        if (trimstdout.indexOf("POLE") > -1) {
                            var codeb = _.replace(trimstdout, 'POLE', '');
                            pos.statut = 60;
                            pos.codeb = codeb;
                            sock.majTrait(pos);
                            if (pos.jpgfile != undefined) {
                                setTimeout(function() {
                                    fs.unlink(pos.jpgfile, (err) => {
                                        if (err) {
                                            console.error(err);
                                            throw err;
                                        }
                                    });
                                }, 1000);
                            }
                            conn.pool.getConnection(function(err, connection) {
                                // connected! (unless `err` is set)
                                if (err) {
                                    console.error(err);
                                }
                                if (!(codeb == "noBarcodes")) {
                                    connection.query('SELECT s2.`PROPRIETE`,s2.`NUM_DOC` FROM search_doc s1 INNER JOIN search_doc s2 ON s1.`NUM_DOC` = s2.`NUM_DOC` WHERE s1.`PROPRIETE` = "' + pos.codeb + '" AND s2.`NUM_CHAMPS`=12;', function(err, lines, fields) {
                                        if (err) {
                                            pos.statut = "danger";
                                            sock.majTrait(pos);
                                            // TODO
                                            //send mail pour informer que les infos sont inconnu

                                        } else {
                                            pos.numdoc = lines[0].NUM_DOC;
                                            pos.CODEDI = s.CODEDI;
                                            pos.remettant = lines[0].PROPRIETE;
                                            pos.statut = 80;
                                            sock.majTrait(pos);
                                            callback(null, pos);
                                            connection.release();
                                        }
                                    });
                                } else {
                                    pos.statut = 80;
                                    sock.majTrait(pos);
                                    callback(null, pos);
                                    connection.release();
                                }
                            });
                        } else {
                            if (pos.jpgfile != undefined) {
                                setTimeout(function() {
                                    fs.unlink(pos.jpgfile, (err) => {
                                        if (err) {
                                            console.error(err);
                                        }
                                    });
                                }, 1000);
                            }
                            pos.statut = 80;
                            pos.codeb = "noBarcodes";
                            sock.majTrait(pos);
                            callback(null, pos);
                        }
                    }
                };
                //lecture du codeb ou pas celon la societe
                if (s.NEIF == 0) {
                    exec('php barcodereader.php ' + path + filename + '.jpg', barcodeCallback);
                } else {
                    //récupération du num equinox dans le filename
                    var filenameSplit = filename.split("-");
                    var codeb = filenameSplit[0];
                    pos.statut = 60;
                    pos.codeb = codeb;
                    sock.majTrait(pos);

                    conn.pool.getConnection(function(err, connection) {
                        // connected! (unless `err` is set)
                        if (err) {
                            throw err;
                        }
                        connection.query('SELECT s2.`PROPRIETE`,s2.`NUM_DOC` FROM search_doc s1 INNER JOIN search_doc s2 ON s1.`NUM_DOC` = s2.`NUM_DOC` WHERE s1.`PROPRIETE` = "' + pos.codeb + '" AND s2.`NUM_CHAMPS`=12;', function(err, lines, fields) {
                            if (err) {
                                pos.statut = "danger";
                                sock.majTrait(pos);
                                //norelease
                                throw err;
                            }
                            pos.numdoc = lines[0].NUM_DOC;
                            pos.CODEDI = s.CODEDI;
                            pos.remettant = lines[0].PROPRIETE;
                            pos.statut = 80;
                            sock.majTrait(pos);
                            callback(null, pos);
                            connection.release();
                        });
                    });
                }
            };

            var traitFichier = function(type, callback) {
                if (s.NEIF == 0) {
                    if (type == "pdf") {
                        try {
                            exec('convert  -density 300 ' + path + filename + "." + extension + ' -quality 100 ' + path + filename + '.jpg', function(error, stdout, stderr) {
                                if (error) {
                                    console.error(error);
                                }
                                var pos = {
                                    "filename": entry,
                                    "societe": soc,
                                    "statut": 20,
                                    "datetrait": Date.now(),
                                    "jpgfile": path + filename + '.jpg'
                                };
                                sock.majTrait(pos);
                                callback(null, pos);
                            });
                        } catch (e) {
                            console.error(e);
                        }
                    } else {
                        var pos = {
                            "filename": entry,
                            "societe": soc,
                            "statut": 20,
                            "datetrait": Date.now()
                        };
                        sock.majTrait(pos);
                        callback(null, pos);
                    }
                } else {
                    var pos = {
                        "filename": entry,
                        "societe": soc,
                        "statut": 20,
                        "datetrait": Date.now()
                    };
                    sock.majTrait(pos);
                    callback(null, pos);
                }
            };



            traitFichier(extension, traitFichierCallback);
        });
    });


    async.parallel(asyncTasks, function(err, results) {
        var dname = getDname();

        archivage(results, path, dname, soc, archiveCallback);

        endtrait.end_traitement(soc);
    });
}; //trait end

new CronJob('0 */1 * * * *', function() {
    console.info("Téléchargement des fichers commencer");
    conn.pool.getConnection(function(err, connection) {
        // connected! (unless `err` is set)

        connection.query('select CODEDI from ged_import where NOTOK = 0 GROUP BY CODEDI',
            function(err, rowsoc, fields) {
                if (err) {
                    console.error(err);
                }

                async.eachSeries(rowsoc, function(soc, callback) {
                        console.info(soc.CODEDI);
                        var soc;
                        connection.query("select * from ged_import where NOTOK = 0 AND CODEDI = '" + soc.CODEDI + "' LIMIT 10",
                            function(err, rows, fields) {
                                if (err) {
                                    console.error(err);
                                }
                                var dataPos = [];
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
                                                    request(uri).pipe(
                                                        fs.createWriteStream(filenameFormat).on('error', function(err) {
                                                            console.log("ERROR:" + err);
                                                            //TODO if error send error
                                                            //sock.sendErrorMsg();

                                                        })).on('close', callback(null, filenameFormat));

                                                } catch (e) {
                                                    console.error(e);
                                                }
                                            });
                                        };

                                        //NUMEQUINOXE, URL_EQUINOXE, CODEDI, NOTOK
                                        download(row.URL_EQUINOXE, 'dl/' + row.NUMEQUINOXE + '_' + row.CODEDI + '_' + Date.now(), function(err, filenameFormat) {

                                            callback();

                                            connection.query('SELECT s2.`PROPRIETE`,s2.`NUM_DOC` FROM search_doc s1 INNER JOIN search_doc s2 ON s1.`NUM_DOC` = s2.`NUM_DOC` WHERE s1.`PROPRIETE` = "' + row.NUMEQUINOXE + '" AND s2.`NUM_CHAMPS`=12;', function(err, lines, fields) {
                                                if (err) {
                                                    //norelease
                                                    throw err;
                                                }
                                                if (lines == 0) {
                                                    console.warning("Informations introuvable pour "+ row.NUMEQUINOXE +" de "+row.CODEDI);
                                                } else {
                                                    var s = _.find(societe, {
                                                        'CODEDI': row.CODEDI
                                                    });

                                                    if (s != undefined) {
                                                        soc = s.societe;
                                                        var filenameArray = filenameFormat.split("/");
                                                        var pos = {
                                                            "filename": filenameArray[1],
                                                            "codeb": row.NUMEQUINOXE,
                                                            "numdoc": lines[0].NUM_DOC,
                                                            "CODEDI": row.CODEDI,
                                                            "remettant": lines[0].PROPRIETE
                                                        };

                                                        dataPos.push(pos);
                                                    } else {
                                                        connection.query('SELECT NOM_SOCIETE FROM societe WHERE COD_EDI = ?', [row.CODEDI], function(err, rows, fields) {
                                                            if (err) {
                                                                console.error(err);
                                                            }
                                                            rows.forEach(function(line) {
                                                                var addsociete = {
                                                                    "societe": line.NOM_SOCIETE,
                                                                    "CODEDI": row.CODEDI,
                                                                    "NEIF": "O"
                                                                };
                                                                societe.push(addsociete);

                                                                connection.query('INSERT INTO ged_societe (societe_name, societe_CODEDI, societe_NEIF) VALUES (?, ?, ?)', [line.NOM_SOCIETE, row.CODEDI, "0"], function(err, result) {
                                                                    if (err) {
                                                                        console.error(err);
                                                                    }
                                                                    var s = _.find(societe, {
                                                                        'CODEDI': row.CODEDI
                                                                    });
                                                                    soc = s.societe;
                                                                    var filenameArray = filenameFormat.split("/");
                                                                    console.log(filenameArray[1]);
                                                                    var pos = {
                                                                        "filename": filenameArray[1],
                                                                        "codeb": row.NUMEQUINOXE,
                                                                        "numdoc": lines[0].NUM_DOC,
                                                                        "CODEDI": row.CODEDI,
                                                                        "remettant": lines[0].PROPRIETE
                                                                    };

                                                                    dataPos.push(pos);
                                                                });
                                                            })

                                                        });

                                                    }
                                                }
                                            });
                                        });
                                    },
                                    function(err) {
                                        if (err) {
                                            console.info('A file failed to process');
                                        } else {
                                            console.info('All files have been processed successfully');
                                            callback();

                                            var dname = getDname();
                                            archivage(dataPos, "dl/", dname, soc, archiveCallback)
                                        }
                                    });
                            });
                    },
                    function(err) {
                        if (err) {
                            console.info('A file failed to process');
                        } else {
                            console.info('All society have been processed successfully');
                        }
                    });
                connection.release();
            });
    });
}, null, false, 'Europe/Paris');

var archiveCallback = function(error, positions) {
    insertBDD(positions);
};

function archivage(results, path, dname, soc, callback) {
    var positions = [];
    var asyncTasksEqui = [];
    var lastcodeb;

    results.forEach(function(pos) {
        var filename = pos.filename.substring(0, pos.filename.length - 4);
        var extension = pos.filename.slice(-3);

        if (pos.codeb == "noBarcodes" || pos.codeb == lastcodeb) {
            //get positions with numequinox == lastcodeb
            var spos = _.find(positions, {
                'numequinoxe': lastcodeb
            });
            if (spos != undefined) {
                var addpos = {
                    "filename": filename + ".pdf",
                    "originFile": pos.filename,
                    "url": "archive/" + soc + "/" + dname + "/" + filename + ".pdf"
                };
                spos.doc.push(addpos);
            } else {
                fs.rename(path + filename + extension, 'erreur/' + soc + '/' + filename + '_err.' + extension, function(err) {
                    conn.pool.getConnection(function(err, connection) {

                        var schtrait = _.find(traitementList, {
                            'soc': soc
                        });

                        var zip = "";
                        if (schtrait != undefined) {
                            schtrait.zips.forEach(function(item) {
                                zip = zip + ", " + item.zipname
                            });
                        } else {
                            zip = "undefined";
                        }
                        var date = new Date().toISOString().slice(0, 19).replace('T', ' ');
                        connection.query('INSERT INTO ged_erreur (filename, zipfile, societe, errCode, dateerreur) VALUES (?, ?, ?, ?, ?)', [filename + '_err.' + extension, zip, pathSplit[1], "noBarcode", date], function(err, result) {
                            if (err) {
                                console.error(err);
                            }
                            sock.sendErrorMsg(soc, "noBarcode");
                        });
                        connection.release();
                    });
                })
            }

            //TODO
            //creation du fichier LDS
        } else {
            //get info equinox
            lastcodeb = pos.codeb;
            var addpos = {
                "numequinoxe": pos.codeb,
                "numdoc": pos.numdoc,
                "societe": pos.societe,
                "CODEDI": pos.CODEDI,
                "datescan": pos.datetrait,
                "remettant": pos.remettant,
                "doc": [{
                    "filename": filename + ".pdf",
                    "originFile": pos.filename,
                    "url": "archive/" + soc + "/" + dname + "/" + filename + ".pdf"
                }]
            };
            positions.push(addpos);
            //creation du fichier LDS
        }
        fs.mkdir("archive/" + soc, function(e) {
            if (!e || (e && e.code === 'EEXIST')) {
                fs.mkdir("archive/" + soc + "/" + dname, function(e) {
                    if (!e || (e && e.code === 'EEXIST')) {
                        exec('convert -density 150 ' + path + pos.filename + ' -quality 100 ' + path + filename + ".pdf", function(error, stdout, stderr) {
                            if (error) {
                                console.error(error);
                                //throw err;
                            }
                            setTimeout(function() {
                                fs.rename(path + filename + ".pdf", "archive/" + soc + "/" + dname + "/" + filename + ".pdf", function(err, stdout, stderr) {
                                    if (err) {
                                        //pos.statut = "danger";
                                        //sock.majTrait(pos);
                                        //norelease
                                        //console.log(err);
                                        //throw err;
                                    }
                                    fs.stat(path + pos.filename, function(err, stats) {
                                        if (stats != undefined) {
                                            fs.unlink(path + pos.filename, function(err, stdout, stderr) {

                                            })
                                        }
                                    });
                                })
                            }, 2000);
                        });

                    } else {
                        //debug
                        console.error(e);
                    }
                });
            }
        });
        pos.statut = 90;
        sock.majTrait(pos);
    });
    callback(null, positions);
};

function insertBDD(positions) {
    var date = new Date().toISOString().slice(0, 19).replace('T', ' ');
    conn.pool.getConnection(function(err, connection) {
        positions.forEach(function(item) {
            connection.query('INSERT INTO ged_doc (numequinoxe, numdoc, societe, CODEDI, datescan, remettant, doc) VALUES (?, ?, ?, ? ,? ,? ,?)', [item.numequinoxe, item.numdoc, item.societe, item.CODEDI, date, item.remettant, JSON.stringify(item.doc)], function(err, result) {
                if (err) {
                    //norelease
                    console.error(err);
                    item.doc.forEach(function(row) {
                        var pos = {
                            "filename": row.originFile,
                            "societe": item.societe,
                            "statut": "warning",
                            "datetraitstart": row.datescan,
                            "codeerr": err.code
                        };
                        sock.majTrait(pos);
                    });
                } else {
                    console.info("insertion de " + item.numequinoxe);
                    item.doc.forEach(function(row) {
                        var pos = {
                            "filename": row.originFile,
                            "societe": item.societe,
                            "statut": 100,
                            "datetraitstart": row.datescan
                        };
                        sock.majTrait(pos);
                        setTimeout(function() {
                            pos.statut = 110;
                            sock.majTrait(pos);
                        }, 5000);
                    })

                    //retour image
                    //traitRenvoie(ftp, item, item.societe, true);
                }
            });
        })
        connection.release();
    });
}



function traitRenvoie(ftp, item, soc, remettant) {
    var s = _.find(societe, {
        'societe': soc
    });
    if (s.ftp != "##NORETOUR") {
        var ftpJSON = _.replace(s.ftp, new RegExp("\\\\", "g"), "");
        var ftp = JSON.parse(ftpJSON);

        var c = new Client();
        c.on('ready', function() {
            var pdftojoin = "";
            switch (ftp.filetype) {
                case "jpg":
                    // TODO: convert jpg to pdf

                    break;
                case "pdf":
                    item.doc.forEach(function(row) {
                        pdftojoin = pdftojoin.concat(" " + row.url);
                    });
                    //if multi true
                    if (ftp.multi) {
                        exec('pdftk' + pdftojoin + " cat output temp/" + item.numequinoxe + ".pdf", function(error, stdout, stderr) {
                            //put en fct de la ftp.nomenclature
                            putFtp(getNomenclatureFile(ftp.nomenclature, item));

                        });
                    } else {
                        item.doc.forEach(function(row, index) {
                            //put en fct de la ftp.nomenclature
                            putFtp(getNomenclatureFile(ftp.nomenclature, item, index));
                        });
                    }
                    break;
                default:
            }
        });

        function putFtp(nomenclatureFile) {
            c.put('temp/' + nomenclatureFile + '.pdf', nomenclatureFile + '.pdf', function(err) {
                if (err) {
                    console.error(err);
                }
                c.end();
            });

            if (remettant) {
                //if item.remettant  want return, find ftp config and send
                var r = _.find(societe, {
                    'societe': item.remettant
                });

                if (r != undefined) {
                    var ftpRJSON = _.replace(r.ftp, new RegExp("\\\\", "g"), "");
                    var ftpR = JSON.parse(ftpRJSON);
                    if (ftpR.renvoieremettant) {
                        traitRenvoie(ftp, item, item.remettant, false);
                    }
                }
            }
        }

        c.connect({
            host: ftp.host,
            port: ftp.port,
            user: ftp.user,
            password: ftp.password
        });

    } else {
        if (remettant) {
            //if item.remettant  want return, find ftp config and send
            var r = _.find(societe, {
                'societe': item.remettant
            });

            if (r != undefined) {
                if (s.ftp != "##NORETOUR") {
                    var ftpRJSON = _.replace(r.ftp, new RegExp("\\\\", "g"), "");
                    var ftpR = JSON.parse(ftpRJSON);
                    if (ftpR.renvoieremettant) {
                        traitRenvoie(ftp, item, item.remettant, false);
                    }
                }
            }
        }
    }
}

function getDname() {
    var now = new Date();
    var month = new Array();
    month[0] = "Janvier";
    month[1] = "Fevrier";
    month[2] = "Mars";
    month[3] = "Avril";
    month[4] = "Mai";
    month[5] = "Juin";
    month[6] = "Juillet";
    month[7] = "Aout";
    month[8] = "Septembre";
    month[9] = "Octobre";
    month[10] = "Novembre";
    month[11] = "Decembre";

    return ("0" + now.getDate()).slice(-2) + "_" + month[now.getMonth()] + "_" + now.getFullYear();
}

function getNomenclatureFile(nomenclature, pos, index) {
    switch (nomenclature) {
        case "numequinoxe_date_remettant":
            return pos.numequinoxe + "_" + pos.datescan + "_" + pos.remettant;
            break;
        case "numequinoxe_date":
            return pos.numequinoxe + "_" + pos.datescan;
            break;
        case "numequinoxe_remettant":
            return pos.numequinoxe + "_" + pos.remettant;
            break;
        case "numequinoxe_remettant_index":
            return pos.numequinoxe + "_" + pos.remettant + "_" + index;
            break;
        default:
            return pos.numequinoxe + "_" + pos.datescan;
    }
}

//traitement de creation de societe

exports.creationSociete = function(soc, CODEDI, NEIF) {
    //ARCHIVE/SOCIETE
    fs.mkdir("archive/" + soc, function() {
        //ARCHIVE/SOCITE/ZIP
        fs.mkdir("archive/" + soc + "/zip", function() {});
    });
    //RECEPTION/SOCIETE
    fs.mkdir("reception/" + soc, function() {});

    //TODO refresh liste des societes
}
