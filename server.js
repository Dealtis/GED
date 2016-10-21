var express = require('express');
var app = express();
var _ = require('lodash');
const fs = require('fs');
var exec = require('child_process').exec,
    child;
var scribe = require('scribe-js')();
var conn = require('./conn');
var CronJob = require('cron').CronJob;

var console = process.console;

const nodemailer = require('nodemailer');

var smtpConfig = {
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // use SSL
    auth: {
        user: 'vanardois.romain@gmail.com',
        pass: 'azerty0612+'
    }
};

//cleaning temp
new CronJob('0 */120 * * * *', function() {
    console.log("Clean /temp");
    fs.readdir('temp/', function(err, data) {
        if (err) {
            console.log("readir" + err);
        }
        try {
            data.forEach(function(entry) {
                fs.unlink('temp/' + entry, (err) => {
                    if (err) {
                        throw err;
                    }
                });
            });
        } catch (e) {
            if (e !== BreakException) throw e;
        }
    });
}, null, true, 'Europe/Paris');

var transporter = nodemailer.createTransport(smtpConfig);

// verify connection configuration
transporter.verify(function(error, success) {
    if (error) {
        console.log(error);
    } else {
        console.log('(▀¯▀) MAIL SERVER START (▀¯▀)');
    }
});


var mailData = {
    from: 'vanardois.romain@gmail.com',
    to: 'rvanardois@dealtis.fr',
    subject: 'Server GED POLE Start',
    html: '<!DOCTYPE html "-//w3c//dtd xhtml 1.0 transitional //en" "http://www.w3.org/tr/xhtml1/dtd/xhtml1-transitional.dtd"><html xmlns="http://www.w3.org/1999/xhtml"><head><!--[if gte mso 9]><xml> <o:OfficeDocumentSettings> <o:AllowPNG/> <o:PixelsPerInch>96</o:PixelsPerInch> </o:OfficeDocumentSettings> </xml><![endif]--> <meta http-equiv="Content-Type" content="text/html; charset=utf-8"> <meta name="viewport" content="width=device-width"> <meta http-equiv="X-UA-Compatible" content="IE=9; IE=8; IE=7; IE=EDGE"> <title>Template Base</title> <link href="https://fonts.googleapis.com/css?family=Bitter" rel="stylesheet" type="text/css"> </head><body style="width: 100% !important;min-width: 100%;-webkit-text-size-adjust: 100%;-ms-text-size-adjust: 100% !important;margin: 0;padding: 0;background-color: #FFFFFF"> <style id="media-query"> /* Client-specific Styles & Reset */ #outlook a{padding: 0;}/* .ExternalClass applies to Outlook.com (the artist formerly known as Hotmail) */ .ExternalClass{width: 100%;}.ExternalClass, .ExternalClass p, .ExternalClass span, .ExternalClass font, .ExternalClass td, .ExternalClass div{line-height: 100%;}#backgroundTable{margin: 0; padding: 0; width: 100% !important; line-height: 100% !important;}/* Buttons */ .button a{display: inline-block; text-decoration: none; -webkit-text-size-adjust: none; text-align: center;}.button a div{text-align: center !important;}/* Outlook First */ body.outlook p{display: inline !important;}/* Media Queries */@media only screen and (max-width: 500px){table[class="body"] img{height: auto !important; width: 100% !important;}table[class="body"] img.fullwidth{max-width: 100% !important;}table[class="body"] center{min-width: 0 !important;}table[class="body"] .container{width: 95% !important;}table[class="body"] .row{width: 100% !important; display: block !important;}table[class="body"] .wrapper{display: block !important; padding-right: 0 !important;}table[class="body"] .columns, table[class="body"] .column{table-layout: fixed !important; float: none !important; width: 100% !important; padding-right: 0px !important; padding-left: 0px !important; display: block !important;}table[class="body"] .wrapper.first .columns, table[class="body"] .wrapper.first .column{display: table !important;}table[class="body"] table.columns td, table[class="body"] table.column td, .col{width: 100% !important;}table[class="body"] table.columns td.expander{width: 1px !important;}table[class="body"] .right-text-pad, table[class="body"] .text-pad-right{padding-left: 10px !important;}table[class="body"] .left-text-pad, table[class="body"] .text-pad-left{padding-right: 10px !important;}table[class="body"] .hide-for-small, table[class="body"] .show-for-desktop{display: none !important;}table[class="body"] .show-for-small, table[class="body"] .hide-for-desktop{display: inherit !important;}.mixed-two-up .col{width: 100% !important;}}@media screen and (max-width: 500px){div[class="col"]{width: 100% !important;}}@media screen and (min-width: 501px){table[class="container"]{width: 500px !important;}}</style> <table class="body" style="border-spacing: 0;border-collapse: collapse;vertical-align: top;height: 100%;width: 100%;table-layout: fixed" cellpadding="0" cellspacing="0" width="100%" border="0"> <tbody><tr style="vertical-align: top"> <td class="center" style="word-break: break-word;border-collapse: collapse !important;vertical-align: top;text-align: center;background-color: #FFFFFF" align="center" valign="top"> <table style="border-spacing: 0;border-collapse: collapse;vertical-align: top;background-color: transparent" cellpadding="0" cellspacing="0" align="center" width="100%" border="0"> <tbody><tr style="vertical-align: top"> <td style="word-break: break-word;border-collapse: collapse !important;vertical-align: top" width="100%"><!--[if gte mso 9]> <table id="outlookholder" border="0" cellspacing="0" cellpadding="0" align="center"><tr><td><![endif]--><!--[if (IE)]> <table width="500" align="center" cellpadding="0" cellspacing="0" border="0"> <tr> <td><![endif]--> <table class="container" style="border-spacing: 0;border-collapse: collapse;vertical-align: top;max-width: 500px;margin: 0 auto;text-align: inherit" cellpadding="0" cellspacing="0" align="center" width="100%" border="0"><tbody><tr style="vertical-align: top"><td style="word-break: break-word;border-collapse: collapse !important;vertical-align: top" width="100%"><table class="block-grid" style="border-spacing: 0;border-collapse: collapse;vertical-align: top;width: 100%;max-width: 500px;color: #000000;background-color: transparent" cellpadding="0" cellspacing="0" width="100%" bgcolor="transparent"><tbody><tr style="vertical-align: top"><td style="word-break: break-word;border-collapse: collapse !important;vertical-align: top;text-align: center;font-size: 0"><div class="col num12" style="display: inline-block;vertical-align: top;width: 100%"><table style="border-spacing: 0;border-collapse: collapse;vertical-align: top" cellpadding="0" cellspacing="0" align="center" width="100%" border="0"><tbody><tr style="vertical-align: top"><td style="word-break: break-word;border-collapse: collapse !important;vertical-align: top;background-color: transparent;padding-top: 5px;padding-right: 0px;padding-bottom: 5px;padding-left: 0px;border-top: 0px solid transparent;border-right: 0px solid transparent;border-bottom: 0px solid transparent;border-left: 0px solid transparent"><table style="border-spacing: 0;border-collapse: collapse;vertical-align: top" cellpadding="0" cellspacing="0" width="100%" border="0"> <tbody><tr style="vertical-align: top"> <td style="word-break: break-word;border-collapse: collapse !important;vertical-align: top;width: 100%;padding-top: 0px;padding-right: 0px;padding-bottom: 0px;padding-left: 0px" align="center"> <div style="font-size:12px" align="center"> <img class="center fullwidth" style="outline: none;text-decoration: none;-ms-interpolation-mode: bicubic;clear: both;display: block;border: 0;height: auto;line-height: 100%;margin: 0 auto;float: none;width: 100% !important;max-width: 500px" align="center" border="0" src="https://i.gyazo.com/7579cc592d482fa30dc8c8f245a84f15.jpg" alt="Image" title="Image" width="500"> </div></td></tr></tbody></table><table style="border-spacing: 0;border-collapse: collapse;vertical-align: top" cellpadding="0" cellspacing="0" width="100%"> <tbody><tr style="vertical-align: top"> <td style="word-break: break-word;border-collapse: collapse !important;vertical-align: top;padding-top: 10px;padding-right: 10px;padding-bottom: 10px;padding-left: 10px"> <div style="color:#555555;line-height:120%;font-family:\'Bitter\', Georgia, Times, \'Times New Roman\', serif;"> <div style="font-size:12px;line-height:14px;font-family:Bitter, Georgia, Times, &quot;Times New Roman&quot;, serif;color:#555555;text-align:left;"><p style="margin: 0;font-size: 14px;line-height: 17px;text-align: center"><span style="font-size: 24px; line-height: 28px;">C\'est du g&#226;teau&nbsp;</span>!</p></div></div></td></tr></tbody></table></td></tr></tbody></table></div></td></tr></tbody></table></td></tr></tbody></table><!--[if mso]> </td></tr></table><![endif]--><!--[if (IE)]> </td></tr></table><![endif]--> </td></tr></tbody></table> </td></tr></tbody></table></body></html>'
};

// transporter.sendMail(mailData, function(err) {
//     if (err) {
//         // check if htmlstream is still open and close it to clean up
//     }
// });

//server
app.use(express.static('release'));
console.log("(▀¯▀) GED POLE START (▀¯▀)");


var server = app.listen(3030, function() {});

app.use('/logs', scribe.webPanel());


//Create a Console2 for express
//with logs saved in /expressLogger
var expressConsole = scribe.console({
    console: {
        colors: 'white',
        timeColors: ['grey', 'underline'],
    },
    createBasic: false,
    logWriter: {
        rootPath: 'expressLogger'
    }
});

expressConsole.addLogger('info');

app.use(scribe.express.logger(expressConsole));

//getfile
app.get('/ged/:numequinoxe', function(req, res) {
    conn.pool.getConnection(function(err, connection) {
        // connected! (unless `err` is set)
        if (err) {
            console.log(err);
        }
        connection.query('SELECT doc, numequinoxe FROM ged_doc g WHERE g.numequinoxe = "' + req.params.numequinoxe + '"', function(err, rows, fields) {
            if (rows.length > 0) {
                var docR = _.replace(rows[0].doc, new RegExp("\\\\", "g"), "");
                var doc = JSON.parse(docR);
                switch (doc[0].filename.slice(-3)) {
                    case "jpg":

                        break;
                    case "pdf":
                        var out = "";
                        doc.forEach(function(doc) {
                            out = out.concat(" " + doc.url);
                        });
                        //pdftk in1.pdf in2.pdf cat output out1.pdf
                        exec('pdftk' + out + " cat output temp/" + rows[0].numequinoxe + ".pdf", function(error, stdout, stderr) {
                            fs.readFile("temp/" + rows[0].numequinoxe + ".pdf", function(err, data) {
                                res.contentType("application/pdf");
                                res.send(data);
                            });
                        });
                        break;
                    default:
                }

            } else {
                res.send('Hello World!');
            }

        });
    });
});


//socket
var socket = require('socket.io');
var io = socket(server);

io.on('connection', function(socket) {
    console.log("New con " + socket.id);
    socket.join('admin');
    socket.on('requestTrait', function() {
        socket.emit('responseTrait', traitPos);
    });
});

io.on('requestTrait', function(socket) {
    console.log("New con " + socket.id);
    socket.join('admin');
});

//requestDeleteError
io.on('requestDeleteError', function(societe, filename) {
    console.log("New delete error");
    fs.unlink("erreur/" + societe + "/" + filename, (err) => {
        if (err) {
            debugger;
            throw err;
        } else {
            //supp dans la bdd
            conn.pool.getConnection(function(err, connection) {
                // connected! (unless `err` is set)
                if (err) {
                    console.log(err);
                }
                connection.query('DELETE FROM ged_erreur WHERE filename =' + filename + '', function(err, rows, fields) {
                    if (err) {
                        console.log(err);
                    }
                });
            });
        }
    });
});

var traitPos = [];

exports.sendMail = function(mailData) {
    transporter.sendMail(mailData, function(err) {
        if (err) {}
    });
}


fs.readFile('mail/error.html', function(err, html) {
    if (err) {
        throw err;
    }
    var sendErrorMsg = transporter.templateSender({
        subject: 'GED Erreur {{societe}}!',
        html: html
    }, {
        from: 'rvanardois@dealtis.fr',
    });

    exports.sendErrorMsg = function(societe, errCode) {
        sendErrorMsg({
            to: 'rvanardois@dealtis.fr'
        }, {
            societe: societe,
            errCode: errCode
        }, function(err, info) {
            if (err) {
                console.log('Error');
            } else {
                console.log('Error Msg sent');
            }
        });
    };
});

exports.majTrait = function(pos) {
    var schfile = _.find(traitPos, {
        'filename': pos.filename
    });
    if (schfile == undefined) {
        traitPos.push(pos);
        io.to('admin').emit('newpos', pos);
    } else {
        schfile.statut = pos.statut;
        io.to('admin').emit('majpos', pos);
        if (pos.statut == 110 || pos.statut == "delerr") {
            var evens = _.remove(traitPos, function(n) {
                return n.filename == pos.filename;
            });
        }
    }
};
