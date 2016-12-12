var async = require('async');
var _ = require('lodash');
var Client = require('ftp');
var fs = require('fs-extra')
var CronJob = require('cron').CronJob;
var exec = require('child_process').exec;
var request = require('request');
var conn = require('./conn');
var sock = require('./server');
var endtrait = require('./app');

//societe
var societe = [];
var console = process.console;
conn.pool.getConnection(function(err, connection) {
    connection.query('select * from ged_societe',
        function(err, rows) {
            if (err) {
                console.log(err.code);
                throw err;
            }
            rows.forEach(function(row) {
                var addsociete = {
                    "societe": row.societe_name,
                    "CODEDI": row.societe_CODEDI,
                    "NEIF": row.societe_NEIF,
                    "SIRET": row.societe_SIRET
                };
                societe.push(addsociete);
            })
            endtrait.onRestart();
            connection.release();
        });
});


setTimeout(function() {
    sock.sendRestartMsg();
}, 5000);

exports.trait = function(liste, soc, path) {
    console.info(`Lancement du traitement de ${soc}`);
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
                var barcodeCallback = function(error, barcode) {
                    console.log(barcode);
                    //if error retry
                    if (error) {
                        setTimeout(function() {
                            exec('php barcodereader.php ' + path + filename + '.jpg', barcodeCallback);
                        }, 1000);
                        console.error(error);
                        //callback(error);
                    } else {
                        var trimstdout = _.trim(barcode);
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
                            if (err) {
                                console.error(err);
                            }
                            if (!(codeb == "noBarcodes")) {
                                var getInfoCallback = function(err, pos) {
                                    console.log(pos);
                                    callback(null, pos);
                                };
                                getInfo(codeb, soc, path, filename, extension, pos, getInfoCallback)
                            } else {
                                pos.statut = 80;
                                sock.majTrait(pos);
                                console.log(pos);
                                callback(null, pos);
                            }
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
                            console.log(pos);
                            callback(null, pos);
                        }
                    }
                };
                //lecture du codeb ou pas celon la societe
                if (s.NEIF == 0) {
                    exec('php barcodereader.php ' + path + filename + '.jpg', barcodeCallback);
                } else {
                    //récupération du numequinoxe dans le filename
                    var filenameSplit = filename.split("-");
                    var codeb = filenameSplit[0];
                    pos.statut = 60;
                    pos.codeb = codeb;
                    sock.majTrait(pos);
                    var getInfoCallback = function(err, pos) {
                        console.log(pos);
                        callback(null, pos);
                    };
                    getInfo(codeb, soc, path, filename, extension, pos, getInfoCallback);
                }
            };

            var traitFichier = function(type, callback) {
                if (s.NEIF == 0) {
                    if (type == "pdf") {
                        try {
                            exec('convert -verbose -density 150 -trim ' + path + filename + "." + extension + ' -quality 100 -flatten -sharpen 0x1.0 ' + path + filename + '.jpg', function(error) {
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
                    pos = {
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
        console.log("asyncTasks");
        var dname = getDname();
        archivage(results, path, dname, soc, archiveCallback);
        endtrait.end_traitement(soc);
    });
}; //trait end

new CronJob('0 */1 * * * *', function() {
    console.info("Téléchargement des fichers start");
    conn.pool.getConnection(function(err, connection) {
        // connected! (unless `err` is set)
        connection.query('select CODEDI from ged_import where NOTOK = 0 GROUP BY CODEDI',
            function(err, rowsoc) {
                if (err) {
                    console.error(err);
                }
                async.eachSeries(rowsoc, function(soc, callback) {
                        console.info(soc.CODEDI);
                        connection.query("select * from ged_import where NOTOK = 0 AND CODEDI = '" + soc.CODEDI + "' LIMIT 10",
                            function(err, rows) {
                                if (err) {
                                    console.error(err);
                                }
                                var dataPos = [];
                                async.eachSeries(rows, function(row, callback) {
                                        var download = function(uri, filename, callback) {
                                            request.head(uri, function(err, res) {
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
                                            connection.query('SELECT s2.`PROPRIETE`,s2.`NUM_DOC` FROM search_doc s1 INNER JOIN search_doc s2 ON s1.`NUM_DOC` = s2.`NUM_DOC` WHERE s1.`PROPRIETE` = "' + row.NUMEQUINOXE + '" AND s2.`NUM_CHAMPS`=12;', function(err, lines) {
                                                if (err) {
                                                    //norelease
                                                    //throw err;
                                                }
                                                var s = _.find(societe, {
                                                    'CODEDI': row.CODEDI
                                                });

                                                var filenameArray = filenameFormat.split("/");
                                                var fn = filenameArray[1].split(".");

                                                if (lines == 0) {
                                                    if (s != undefined) {
                                                        console.warning("Informations introuvable pour " + row.NUMEQUINOXE + " de " + row.CODEDI);
                                                        setError('dl/' + row.NUMEQUINOXE, fn[0], fn[1], s.societe, "noInformation");
                                                    }
                                                } else {
                                                    if (s != undefined) {
                                                        soc = s.societe;

                                                        var pos = {
                                                            "filename": filenameArray[1],
                                                            "codeb": row.NUMEQUINOXE,
                                                            "numdoc": lines[0].NUM_DOC,
                                                            "CODEDI": row.CODEDI,
                                                            "remettant": lines[0].PROPRIETE
                                                        };

                                                        dataPos.push(pos);
                                                    } else {
                                                        connection.query('SELECT NOM_SOCIETE FROM societe WHERE COD_EDI = ?', [row.CODEDI], function(err, rows) {
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

                                                                connection.query('INSERT INTO ged_societe (societe_name, societe_CODEDI, societe_NEIF) VALUES (?, ?, ?)', [line.NOM_SOCIETE, row.CODEDI, "0"], function(err) {
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

var archiveCallback = function(error, positions, dname) {
    insertBDD(positions, dname);
};

function archivage(results, path, dname, soc, callback) {
    var positions = [];
    var lastcodeb;
    results.forEach(function(pos) {
        if (pos != null) {
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
                        "path": path,
                        "originFile": pos.filename,
                        "url": "archive/" + soc + "/" + dname + "/" + filename + ".pdf"
                    };
                    spos.doc.push(addpos);
                } else {
                    setError(path, filename, extension, soc, "noBarcode");
                }
            } else {
                //get info equinox
                lastcodeb = pos.codeb;
                addpos = {
                    "numequinoxe": pos.codeb,
                    "numdoc": pos.numdoc,
                    "societe": pos.societe,
                    "CODEDI": pos.CODEDI,
                    "datescan": pos.datetrait,
                    "remettant": pos.remettant,
                    "doc": [{
                        "filename": filename + ".pdf",
                        "path": path,
                        "originFile": pos.filename,
                        "url": "archive/" + soc + "/" + dname + "/" + filename + ".pdf"
                    }]
                };
                positions.push(addpos);
            }
            pos.statut = 90;
            sock.majTrait(pos);
        }
    });
    callback(null, positions, dname);
}

function moveToArchive(soc, dname, path, filename, originFile, position) {
    var ndocSPlit = filename.split(".");
    fs.mkdir("archive/" + soc, function(e) {
        if (!e || (e && e.code === 'EEXIST')) {
            fs.mkdir("archive/" + soc + "/" + dname, function(e) {
                if (!e || (e && e.code === 'EEXIST')) {
                    setTimeout(function() {
                        fs.rename(path + filename, "archive/" + soc + "/" + dname + "/" + filename, function(err) {
                            if (err) {
                                console.log(`Archivage de ${filename} de ${soc} en erreur ${err}`);
                                setError(path, ndocSPlit[0], ndocSPlit[1], soc, `Archivage de ${filename} de ${soc} en erreur ${err}`);
                            } else {

                                //Traitement old ged
                                //faire une copie du fichier
                                fs.copy(`archive/${soc}/${dname}/${filename}`, `****le dossier de l'ancien archivage******`, function(err) {
                                    if (err) return console.error(err)
                                    console.log("success!")
                                })

                                //convertir le fichier en jpg

                                //rename en jpg0
                                fs.rename(path + filename, "archive/" + soc + "/" + dname + "/" + filename, function(err) {

                                });

                                conn.pool.getConnection(function(err, connection) {
                                    connection.query('**LA SUPER REQUETE**', function(err, lines) {
                                        if (err) {
                                            console.log(err);
                                        }
                                        //crée le fichier LDS
                                        var entete_1 = "<LDS001>";
                                        var entete_2 = "<idx nb=12>";
                                        var val1 = pos.numdoc;
                                        var val2 = new Date().toISOString().slice(0, 10).replace(/-/g, "");
                                        var val3 = getSiretSociete(soc);
                                        var val4 = pos.numequinoxe;
                                        var val5 = soc;
                                        var val6 = "";
                                        var val7 = pos.remettant;
                                        var val8 = "";
                                        var val9 = "";
                                        var val10 = new Date().toISOString().slice(0, 10).replace(/-/g, "");
                                        var val11 = `${ndocSPlit[0]}.jpg`;
                                        var val12 = "ok";
                                        fs.writeFile(`oldArchive/${ndocSPlit[0]}.lds`, dataLds, (err) => {
                                            if (err) throw err;
                                        });
                                    });
                                });




                                //if pos.originFile exist delete it
                                fs.stat(path + originFile, function(error, stats) {
                                    if (stats != undefined) {
                                        fs.unlink(path + originFile, function(error) {
                                            if (error) {
                                                console.error(error);
                                            }
                                        })
                                    }
                                });
                                console.log(`Archivage de ${filename} de ${soc} done`);
                            }
                        })
                    }, 2000);
                } else {
                    console.error(e);
                }
            });
        }
    });
}

function insertBDD(positions, dname) {
    var date = new Date().toISOString().slice(0, 19).replace('T', ' ');
    conn.pool.getConnection(function(err, connection) {
        positions.forEach(function(pos) {
            connection.query('INSERT INTO ged_doc (numequinoxe, numdoc, societe, CODEDI, datescan, remettant, doc) VALUES (?, ?, ?, ? ,? ,? ,?)', [pos.numequinoxe, pos.numdoc, pos.societe, pos.CODEDI, date, pos.remettant, JSON.stringify(pos.doc)], function(err) {
                if (err) {
                    console.log(err);
                    //if code ER_DUP_ENTRY ajouté au doc
                    if (err.code = "ER_DUP_ENTRY") {
                        connection.query('SELECT doc FROM ged_doc WHERE numequinoxe = ?', [pos.numequinoxe], function(err, rows) {
                            if (err) {
                                console.error(err);
                            }
                            var docR = _.replace(rows[0].doc, new RegExp("\\\\", "g"), "");
                            var ArrayDoc = JSON.parse(docR);

                            pos.doc.forEach(function(ndoc) {
                                var ndocSPlit = ndoc.filename.split('.');
                                var ndocUrl = ndoc.url.split('/');
                                ndoc.filename = `${ndocSPlit[0]}_${ArrayDoc.length + 1}.${ndocSPlit[1]}`;
                                ndoc.url = `${ndocUrl[0]}/${ndocUrl[1]}/${ndocUrl[2]}/${ndoc.filename}`;
                                ArrayDoc.push(ndoc);
                                exec('convert -density 150 ' + ndoc.path + ndoc.originFile + ' -quality 100 ' + ndoc.path + ndoc.filename, function(error) {
                                    if (error) {
                                        console.error(error);
                                        setError(ndoc.path, ndocSPlit[0], ndocSPlit[1], pos.societe, `convert -density 150 ${ndoc.path + ndoc.originFile} -quality 100 ${ndoc.path + ndoc.filename}`);
                                    } else {
                                        moveToArchive(pos.societe, dname, ndoc.path, ndoc.filename, ndoc.originFile, pos);
                                        var Npos = {
                                            "filename": ndoc.originFile,
                                            "societe": pos.societe,
                                            "statut": 100,
                                            "datetraitstart": pos.datescan
                                        };
                                        sock.majTrait(Npos);
                                        setTimeout(function() {
                                            Npos.statut = 110;
                                            sock.majTrait(Npos);
                                        }, 5000);
                                    }
                                });
                            })

                            connection.query('UPDATE ged_doc SET doc = ? WHERE numequinoxe = ?', [JSON.stringify(ArrayDoc), pos.numequinoxe], function(err) {
                                if (err) {
                                    console.error(err);
                                } else {
                                    console.info("Update done");
                                }
                            });
                        });
                    } else {
                        console.error(err);

                        item.doc.forEach(function(row) {
                            var Npos = {
                                "filename": row.originFile,
                                "societe": pos.societe,
                                "statut": "warning",
                                "datetraitstart": pos.datescan,
                                "codeerr": err.code
                            };
                            sock.majTrait(Npos);
                        });
                    }
                } else {
                    console.info("insertion de " + pos.numequinoxe);
                    pos.doc.forEach(function(ndoc) {
                        var ndocSPlit = ndoc.filename.split('.');
                        exec('convert -density 150 ' + ndoc.path + ndoc.originFile + ' -quality 100 ' + ndoc.path + ndoc.filename, function(error) {
                            if (error) {
                                console.error(error);
                                setError(ndoc.path, ndocSPlit[0], ndocSPlit[1], pos.societe, `convert -density 150 ${ndoc.path + ndoc.originFile} -quality 100 ${ndoc.path + ndoc.filename}`);
                            } else {
                                moveToArchive(pos.societe, dname, ndoc.path, ndoc.filename, ndoc.originFile, pos);
                            }
                        });

                        var Npos = {
                            "filename": ndoc.originFile,
                            "societe": pos.societe,
                            "statut": 100,
                            "datetraitstart": pos.datescan
                        };
                        sock.majTrait(Npos);
                        setTimeout(function() {
                            Npos.statut = 110;
                            sock.majTrait(Npos);
                        }, 5000);
                    });
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
        ftp = JSON.parse(ftpJSON);
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
                        exec('pdftk' + pdftojoin + " cat output temp/" + item.numequinoxe + ".pdf", function(error) {
                            if (error) {
                                console.error(error);
                            }
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

function setError(path, filename, extension, soc, errCode) {
    fs.rename(path + filename + "." + extension, 'erreur/' + soc + '/' + filename + '_err.' + extension, function(err) {
        if (err) {
            console.error(err);
        }
        conn.pool.getConnection(function(err, connection) {
            if (err) {
                console.error(err);
            }
            var schtrait = _.find(endtrait.traitementList, {
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
            connection.query('INSERT INTO ged_erreur (filename, zipfile, societe, errCode, dateerreur) VALUES (?, ?, ?, ?, ?)', [filename + '_err.' + extension, zip, soc, "noBarcode", date], function(err) {
                if (err) {
                    console.error(err);
                }
                sock.sendErrorMsg(soc, errCode, err);
            });
            connection.release();
        });
    })
}

var getInfo = function(numequinoxe, soc, path, filename, extension, pos, callback) {
        conn.pool.getConnection(function(err, connection) {
            if (err) {
                throw err;
            } else {
                connection.query('SELECT s2.`PROPRIETE`,s2.`NUM_DOC` FROM search_doc s1 INNER JOIN search_doc s2 ON s1.`NUM_DOC` = s2.`NUM_DOC` WHERE s1.`PROPRIETE` = "' + numequinoxe + '" AND s2.`NUM_CHAMPS`=12;', function(err, lines) {
                    if (err) {
                        console.error(err);
                    } else {
                        if (lines != 0) {
                            pos.numdoc = lines[0].NUM_DOC;
                            pos.CODEDI = soc.CODEDI;
                            pos.remettant = lines[0].PROPRIETE;
                            pos.statut = 80;
                            sock.majTrait(pos);
                            callback(null, pos);
                        } else {
                            console.error("Informations introuvable pour " + numequinoxe + " de " + soc);
                            setError(path, filename, extension, soc, "noInformation");
                        }
                    }
                    connection.release();
                });
            }
        });
    }
