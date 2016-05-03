// if you don't specify a html file, the sniper will generate a div
var appDiv = document.createElement('div');
yourDiv.appendChild(appDiv);

var app = require("biotea-vis-biolinks");

var topics = {
    ft: [{id: '_107', text: 'Topic with 3ft and 4 ta articles'}],
    ta: [{id: '_106', text: 'Topic with 0ft and 1 ta articles'}, {id: '_107', text: 'Topic with 3ft and 4 ta articles'}]
};

var articles = {
    ft: [
        {topic: '_107', id: '55328', altId: '11532215',
            title: 'Cluster-Rasch models for microarray gene expression data.'},
        {topic: '_107', id: 59472, altId: 11690545,
            title: 'A simple method for statistical analysis of intensity differences in microarray-derived gene expression data.'},
        {topic: '_107', id: 64840, altId: 11790258,
            title: 'Evaluation of normalization procedures for oligonucleotide array data based on spiked cRNA controls.'}
    ],
    ta: [
        {topic: '_106', id: 14521963,
            title: 'A comprehensive search for HNF-3alpha-regulated genes in mouse hepatoma cells by 60K cDNA microarray and chromatin immunoprecipitation/PCR analysis.'},
        {topic: '_107', id: 10773095,
            title: 'Normalization strategies for cDNA microarrays.'},
        {topic: '_107', id: '11532215', altId: '55328',
            title: 'Cluster-Rasch models for microarray gene expression data.'},
        {topic: '_107', id: 11690545, altId: 59472,
            title: 'A simple method for statistical analysis of intensity differences in microarray-derived gene expression data.'},
        {topic: '_107', id: 11790258, altId: 64840,
            title: 'Evaluation of normalization procedures for oligonucleotide array data based on spiked cRNA controls.'}]
};

var instance = new app({
    el: appDiv,
    content: [
        {label: 'ft', text: 'Full content', prefix: 'PMC', seeAlso: 'ta'},
        {label: 'ta', text: 'Title and abstract', prefix: 'PMID'}],
    topics: topics,
    articles: articles,
    paths: {ft: 'http://localhost:9090/snippets/data/pmc/', ta: 'http://localhost:9090/snippets/data/pubmed/'}
});