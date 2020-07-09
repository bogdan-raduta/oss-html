#!/usr/bin/env node

const yargs = require("yargs");

const options = yargs
    .usage("Usage: -i <json_file> -o <html_file>")
    .option("i", { alias: "json_file", describe: "JSON file used for conversion", type: "string", demandOption: true })
    .option("o", { alias: "html_file", describe: "HTML file used for output", type: "string", demandOption: true })
    .argv;

const json_file = options.json_file;
const html_file = options.html_file;

const StreamObject = require('stream-json/streamers/StreamObject');
const { Writable } = require('stream');
const fs = require('fs');
const _ = require('lodash');
const { SSL_OP_DONT_INSERT_EMPTY_FRAGMENTS } = require('constants');

const fileStream = fs.createReadStream(json_file);
const jsonStream = StreamObject.withParser();

let repositoryObj = {};
let analyzerObj = {};
let scannerObj = {};


const processingStream = new Writable({
    write({ key, value }, encoding, callback) {

        //some async operations
        setTimeout(() => {
            console.log('processing ', key.toUpperCase());
            if (key === 'repository') {
                processingRepository(value);
            }
            if (key === 'analyzer') {
                processingAnalyzer(value);
            }
            if (key === 'scanner') {
                processingScanner(value);
            }
            //Runs one at a time, need to use a callback for that part to work
            callback();
        }, 1);
    },
    //Don't skip this, as we need to operate with objects, not buffers
    objectMode: true
});
//Pipe the streams as follows
fileStream.pipe(jsonStream.input);
jsonStream.pipe(processingStream);
//So we're waiting for the 'finish' event when everything is done.
processingStream.on('finish', () => composeHTML(html_file));



const processingAnalyzer = (object) => {
    object = _.omit(object, ['start_time', 'end_time', 'environment', 'config']);
    const itemsPrj = _.map(object.result.projects, (d) => {
        var obj = _.omit(d, ['definition_file_path', 'declared_licenses', 'scopes']);
        obj = _.merge(obj, flatObject('v', obj.vcs));
        obj = _.merge(obj, flatObject('vp', obj.vcs_processed));
        obj = _.merge(obj, flatObject('dlp', obj.declared_licenses_processed));
        delete obj.vcs;
        delete obj.vcs_processed;
        delete obj.declared_licenses_processed;
        delete obj.binary_artifact;
        delete obj.source_artifact;
        if (obj.spdx_expression) {
            obj.spdx_expression = parseSPDXExpresion(obj.spdx_expression)
        }
        if (obj.dlp_spdx_expression) {
            obj.dlp_spdx_expression = parseSPDXExpresion(obj.dlp_spdx_expression)
        }
        if (obj.dlp_unmapped) {
            obj.dlp_unmapped = parseUnmapped(obj.dlp_unmapped)
        }
        return obj;
    })
    object.projects = itemsPrj;

    const itemsPkg = _.map(object.result.packages, (d) => {

        var obj = _.omit(d, ['curations']);
        obj = _.merge(d, d.package);
        delete obj.package;
        obj = _.merge(obj, flatObject('v', obj.vcs));
        obj = _.merge(obj, flatObject('vp', obj.vcs_processed));
        obj = _.merge(obj, flatObject('dlp', obj.declared_licenses_processed));
        obj = _.merge(obj, flatObject('ba', obj.binary_artifact));
        obj = _.merge(obj, flatObject('sa', obj.source_artifact));
        delete obj.vcs;
        delete obj.vcs_processed;
        delete obj.declared_licenses_processed;
        delete obj.binary_artifact;
        delete obj.source_artifact;
        if (obj.spdx_expression) {
            obj.spdx_expression = parseSPDXExpresion(obj.spdx_expression)
        }
        if (obj.dlp_spdx_expression) {
            obj.dlp_spdx_expression = parseSPDXExpresion(obj.dlp_spdx_expression)
        }
        if (obj.dlp_unmapped) {
            obj.dlp_unmapped = parseUnmapped(obj.dlp_unmapped)
        }

        return obj;

    })
    object.packages = itemsPkg;
    delete object.result;
    analyzerObj = object;
}


const processingScanner = (object) => {
    scannerObj = object;
    /*TBD*/
}

const processingRepository = (object) => {
    object = _.merge(object, flatObject('vp', object.vcs_processed));
    delete object.vcs_processed;
    repositoryObj = object;
    /*TBD*/
}




/* utils */
const parseSPDXExpresion = (value) => {
    const filter = value.replace(' AND ', ' ').replace(' WITH ', ' ').replace(' OR ', '');
    var values = filter.split(' ');
    var returnobject = { original: value, extracted: [] }
    for (var i = 0; i < values.length; i++) {
        returnobject.extracted.push({ name: values[i], url: `https://spdx.org/licenses/${values[i]}` })
    }
    return returnobject;
}

const parseUnmapped = (values) => {
    
    var returnobject = { original: '*unmapped*', extracted: [] }
    for (var i = 0; i < values.length; i++) {
        var splitted = values[i].split('|') 
        returnobject.extracted.push({ name: splitted[1], url: `${splitted[2]}` })
    }
    return returnobject;
}

const flatObject = (prefix, object) => {
    if (!object) return null;
    _.forEach(object, (value, key) => {
        newKey = prefix + '_' + key;
        delete object[key]
        object[newKey] = value;
    })
    return object;
}


/*HTML create utils*/

const buildHTML = (header, body) => {
    return '<!DOCTYPE html><html>' + header + '<body>' + body + '</body></html>';
}

const buildHeader = (name) => {
    return '<title>' + name + '</title>'
}

const createTitle = (title) => {
    return '<h2>' + title + '</h2>'
}

const createTableAnalyzer = (analyzer) => {
    var table = '<h3>Analyzer</h3><br/>'
    table = table + '<table border="1">' +
        '<tr bgcolor="#9acd32">' +
        '<th>#</th>' +
        '<th>Library name <br/>(type:group-id:artifact-id:version)</th>' +
        '<th>License identifier <br/> (spdx Identifier <a href="https://spdx.org/licenses/"/>)</th>' +
        '<th>Library homepage url</th>' +
        '<th>Library source code url<br/>(GIT repository)</th>' +
        '</tr>' +
        '<tr bgcolor="#add8e6">' +
        '<td colspan="5">' +
        '<b>Projects</b>' +
        '</td>' +
        '</tr>';

    analyzer.projects.map((project, k) => {
        table = table + '<tr>' +
            `<td>${k + 1}</td>` +
            `<td>${project.id}</td>`;
        if (project.dlp_spdx_expression) {
            table = table + '<td><b>' + project.dlp_spdx_expression.original + '</b><br/><br/>'
            project.dlp_spdx_expression.extracted.map((link) => {
                table = table + `<a href="${link.url}" target="_blank">${link.name}</a>` + '<br/>'
            })

            table = table + '</td>'
        } else if (project.dlp_unmapped) {
            table = table + '<td><b>' + project.dlp_unmapped.original + '</br><br/><br/>'
            project.dlp_unmapped.extracted.map((link) => {
                table = table + `<a href="${link.url}" target="_blank">${link.name}</a>` + '<br/>'
            })

            table = table + '</td>'
        } else {
            table = table + '<td>-</td>'
        }
        table = table +
            `<td><a href="${project.homepage_url}" target="_blank">${project.homepage_url}</a></td>` +
            `<td><a href="${project.vp_url}" target="_blank">${project.vp_url}</a></td>` +
            '</tr>'
    })
    table = table + '<tr bgcolor="#add8e6">' +
        '<td colspan="5">' +
        '<b>Packages</b>' +
        '</td>' +
        '</tr>';
    analyzer.packages.map((package, k) => {
        table = table + '<tr>' +
            `<td>${k + 1}</td>` +
            `<td>${package.id}</td>`;
        if (package.dlp_spdx_expression) {
            table = table + '<td><b>' + package.dlp_spdx_expression.original + '</br><br/><br/>'
            package.dlp_spdx_expression.extracted.map((link) => {
                table = table + `<a href="${link.url}" target="_blank">${link.name}</a>` + '<br/>'
            })

            table = table + '</td>'
        } else if (package.dlp_unmapped) {
            table = table + '<td><b>' + package.dlp_unmapped.original + '</br><br/><br/>'
            package.dlp_unmapped.extracted.map((link) => {
                table = table + `<a href="${link.url}" target="_blank">${link.name}</a>` + '<br/>'
            })

            table = table + '</td>'
        } 
        else {
            table = table + '<td>-</td>'
        }
        table = table +
            `<td>${package.description} <br/><a href="${package.homepage_url}" target="_blank">${package.homepage_url}</a></td>` +
            `<td><a href="${package.vp_url}" target="_blank">${package.vp_url}</a></td>` +
            '</tr>'
    })
    table = table + '</table>';

    return table
}


const composeHTML = (fileName) => {
    var html = ''
    var header = buildHeader('OSS scan')
    var body = ''
    body = createTitle(`Project ${repositoryObj.vp_url}`)
    body = body + createTableAnalyzer(analyzerObj);
    html = buildHTML(header, body);
    writeHTML(fileName, html);
}

const writeHTML = (fileName, content) => {
    var stream = fs.createWriteStream(fileName);

    stream.once('open', function (fd) {
        stream.end(content);
    });
    console.log(`${fileName} generated! Thank You!`);
}
