var restify = require('restify'),
    request = require('request'),
    _       = require('underscore');

var tnames = ['phoenix', 'phoebus','pharos','russia','suomi','eurooppa','aasia','pohjoisamerikka','kehittyva','global-brands','global-pharma','euroobligaatio','eurocorporate','rahamarkkina','omx25'];

var trusts = {};
_.each(tnames, function(name) {
    trusts[name] = {
        url: 'http://www.seligson.fi/graafit/'+name+'.csv',
        data: []
    };
});

function doRequest(name, url) {
    trusts[name].data = [];
    request(url, function(error,resp,body) {
        if(!error && resp.statusCode === 200) {
            var lines = body.split('\n');
            _.each(lines, function(line, index) {
                var data = line.split(';');
                if(data && data.length === 2) {
                    var date = data[0].split('.');
                    trusts[name].data.push({
                        date: new Date(date[2], date[1]-1, date[0], 23, 59, 59),
                        value: data[1]
                    });
                }
            });
        }
    });
}

function mapData(req, name) {
    var from, to,
        fromD, toD,
        names = [];

    if(name) {
        names.push(name);
    }

    if(req.params.from) {
        from = req.params.from.split('.');
        fromD = new Date(from[2], from[1]-1, from[0], 23, 59, 59);
    }

    if(req.params.to) {
        to = req.params.to.split('.');
        toD = new Date(to[2], to[1]-1, to[0], 23, 59, 59);
    }

    if(req.params.trusts) {
        names = req.params.trusts.split(',');
    }

    var datas = _.map(trusts, function(trust, name) {
        var filteredData = _.filter(trust.data, function(data) {
            var ret = false;
            if(fromD || toD) {
                if(fromD && toD) {
                    if(data.date.getTime() > fromD.getTime() && data.date.getTime() < toD.getTime()) {
                        ret = true;
                    } else {
                        ret = false;
                    }
                } else if(fromD && !toD && data.date.getTime() > fromD.getTime()) {
                    ret = true;
                } else if(toD && !fromD && data.date.getTime() < toD.getTime()) {
                    ret = true;
                }
            } else {
                ret = true;
            }
            return ret;
        });

        return {
            name: name,
            data: filteredData
        };
    });

    if(names.length > 0) {
        datas = _.filter(datas, function(data) {
            var found = false;
            _.each(names, function(n) {
                if(n === data.name) {
                    found = true;
                }
            });
            return found;
        });
    }

    return datas;
}

/* Server */
var server = restify.createServer({
    name: 'Seligson trust rest API',
    version: '0.0.1'
});

server.use(restify.acceptParser(server.acceptable));
server.use(restify.queryParser());
server.use(restify.bodyParser());

server.get('/api/list', function (req, res, next) {
    res.send(mapData(req));
    return next();
});

server.get('/api/list/:name', function (req, res, next) {
    res.send(mapData(req, req.params.name));
    return next();
});

server.listen(38357, function () {
    _.each(trusts, function(url, name) {
        doRequest(name, url);
    });

    // 1 hours update interval
    setInterval(function() {
        _.each(trusts, function(url, name) {
            doRequest(name, url);
        });
        console.log("Updated local data");
    }, 36000000);
});
