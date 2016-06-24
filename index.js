var restify = require('restify');
var lda = require('lda');
var removeDiacritics = require('diacritics').remove;

var featureHashing = require('hashingtrick.js');


var fs = require('fs');

var generator = require('knear');
var k = 9;
var machine = new generator.kNear(k);


function vectorize(text, classify) {
    text = removeDiacritics(text).toLowerCase();
    var documents = text.match(/[^\.!\?]+[\.!\?]+/g);
    var result = lda(documents, 3, 3, ['cs', 'en']);

    var arraysToHash = [];

    for (var i in result) {
        var stringsToHash = [];
        var row = result[i];
        //console.log('Topic ' + (parseInt(i) + 1));

        // For each term.
        for (var j in row) {
            var term = row[j];
            //console.log(term.term + ' (' + term.probability + '%)');

            stringsToHash.push( term.term );
        }
        arraysToHash.push(stringsToHash);
    }


    var results = [];

    console.log(arraysToHash);
    arraysToHash.forEach(
        function(arr){

            var featureHasher = featureHashing.newFeatureHasher(18); // Feature vector will be 2^18 elements

            arr.forEach(
                function(str){
                    featureHasher.add(str);
                }
            );

            var vector = featureHasher.sparseFeatureVector();
            var keys = Object.keys(vector);
            console.log(keys);
            results.push({
                'values' : arr,
                'vector' : vector,
                'classification': classify ? machine.classify(keys) : null
            });
        });

    return [result, results];
}

function evaluate(req, res, next) {
    var phrase = req.body;
    res.send(vectorize(phrase, true));
    next();
}

function reload(req, res, next) {

    res.send([]);

    fs.readFile('tags.json', function (err, data) {
        if (err) {
            return console.error(err);
        }
        var data = JSON.parse(data);

        data.forEach(function(row) {

            var result = vectorize(row['text']);
            console.log(row['tag']);
            console.log(result[0]);
            console.log(result[1]);
            console.log("\n");

            result[1].forEach(function(vector) {
                machine.learn(Object.keys(vector['vector']), row['tag']);
            });

        });

    });

    next();

}

function test(req, res, next) {
    var j = JSON.parse(req.body);
    res.send(machine.classify(j));
}

function hash(req, res, next) {
    var text = req.body;

    var featureHasher = featureHashing.newFeatureHasher(18);
    featureHasher.add(text);
    var vector = featureHasher.sparseFeatureVector();

    res.send(vector);
    next();
}

var server = restify.createServer();
server.use(restify.bodyParser({mapParams: true}));

server.post('/ml/test/:text', test);
server.head('/ml/test/:text', test);

server.post('/ml/hash/:text', hash);
server.head('/ml/hash/:text', hash);

server.post('/ml/evaluate/:text', evaluate);
server.head('/ml/evaluate/:text', evaluate);

server.get('/ml/reload/:text', reload);
server.head('/ml/reload/:text', reload);

server.listen(8080, function () {
    console.log('%s listening at %s', server.name, server.url);
});
