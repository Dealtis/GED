var mysql = require('mysql');
exports.pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'phiphi',
    database: 'dealtis_ged',
    port: '3307'
});
