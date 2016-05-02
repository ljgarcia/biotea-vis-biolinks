/*jslint node: true */
/*jshint laxbreak: true */
"use strict";
/*
 * Copyright (c) 2015 ljgarcia
 * Licensed under the Apache 2 license.
 */
var d3 = require('d3');
var _ = require('underscore');
var jQuery = require('jquery');
var BiolinksParser = require('biotea-io-parser');
var AnnotationViewer = require('biotea-vis-annotation');
var DistributionViewer = require('biotea-vis-topicDistribution');
var SimilarityViewer = require('biotea-vis-similarity');

/**
 * Private Methods
 */
/**
 * content: [{label: 'ft', text: 'Full content'}, {label: 'ta', text: 'Titla and abstract'}]
 * topics: {ft: [{id: '', text: ''}], ta: [{id: '', text: ''}]}
 * articles: {ft: [{topic: '', id: '', altId: '', title: ''}], ta: []}
*/
var defaultOpts = {
    title: 'Biotea-Biolinks',
    width: 880,
    annotationHeight: 400,
    similarityHeight: 400,
    distributionHeight: 400,
    content: [],
    topics: {},
    articles: {},
    paths: {},
    onlyTF: false
};

/*
 * Public Methods
 */
var BiolinksViewer = function(opts){
    var viewer = this;
    viewer.options = _.extend({}, defaultOpts, opts);
    viewer.parser = new BiolinksParser();
    init(viewer);
};

var init = function(viewer) {
    var controlsDiv = d3.select(viewer.options.el).append('div').classed('biolinks_menu', true);
    //TODO create group selection and scope menu

    var titleDiv = d3.select(viewer.options.el).append('h1').text(viewer.options.title);

    var contentDiv = d3.select(viewer.options.el).append('div').classed('biolinks_content', true);
    contentDiv.append('span').text('Content/Chapter: ');
    viewer.contentSelect = contentDiv.append('span').append('select')
        .attr('id', 'biolinks_contentSelection')
        .on('change', function() {
            var selectedIndex = viewer.contentSelect.property('selectedIndex')
            viewer.selectedContent = viewer.contentOptions[0][selectedIndex].__data__;
            updateTopics(viewer);
        });

    viewer.contentOptions = viewer.contentSelect.selectAll('option')
        .data(viewer.options.content)
        .enter().append('option')
        .attr('value', function(d) {return d.label;})
        .text(function(d) {return d.text;});
    viewer.selectedContent = viewer.options.content[0];

    var topicsDiv = d3.select(viewer.options.el).append('div');
    topicsDiv.append('span').text('Topic/Subject: ');
    viewer.topicsSelect = topicsDiv.append('span').append('select')
        .attr('id', 'biolinks_topicsSelection')
        .on('change', function() {
            var selectedIndex = viewer.topicsSelect.property('selectedIndex')
            viewer.selectedTopic = viewer.topicsOption[0][selectedIndex].__data__.id;
            updateDistribution(viewer);
        });

    var distributionGroupDiv = d3.select(viewer.options.el).append('div').classed('biolinks_distribution_group', true);
    distributionGroupDiv.append('h2').text('Biolinks (UMLS-based) group distribution')

    distributionGroupDiv.append('div').classed('biolinks_caption', true)
        .html('Rows are semantic groups and columns are articles, the darker a cell the more representative the '
            + 'semantic group for an article. <br/>White means the group is not present in the article. '
            + '<br/>Hover and click any cell for more information');

    var articleDiv = distributionGroupDiv.append('div');
    articleDiv.html('');
    articleDiv.append('span').text('Selected (Query) Article: ');
    viewer.articleTitle = articleDiv.append('span').text('Click on any column in the distribution matrix to select'
        + 'an article. ');

    var distDivId = 'biolinks_dist_' + new Date().getTime();
    viewer.distributionDiv = distributionGroupDiv.append('div')
        .attr('id', distDivId)
        .classed('biolinks_distribution', true);
    viewer.topicDistribution = new DistributionViewer({
        el: '#' + distDivId,
        width: viewer.options.width
    });

    viewer.similarityGroupDiv = d3.select(viewer.options.el).append('div')
        .classed('biolinks_similarity_group', true)
        .style('display', 'none');
    viewer.similarityGroupDiv.append('h2').text('Similarity network for selected (query) article');
    viewer.secondaryArticleDiv = viewer.similarityGroupDiv.append('div');

    viewer.similarityViewers = [];
    var cols = viewer.selectedContent.seeAlso ? 2 : 1;
    var table = viewer.similarityGroupDiv.append('table').attr('width', '100%');
    var row = table.append('tr');
    for (var i = 0; i < cols; i++) {
        row.append('th').text('Similarity for ' + viewer.options.content[i].text);
    }
    row = table.append('tr');
    for (var i = 0; i < cols; i++) {
        var divId = 'biolinks_sim_' + new Date().getTime();
        var simViewer = row.append('td').append('div').attr('id', divId);
        viewer.similarityViewers.push({
            viewer: simViewer,
            id: '#' + divId,
            content: viewer.options.content[i].label
        });
    }

    updateTopics(viewer);
};

var hideSimilarityGroup = function(viewer) {
    viewer.similarityGroupDiv.style('display', 'none');
    viewer.secondaryArticleDiv.text('');
    _.each(viewer.similarityViewers, function(simViewer) {
        d3.select(simViewer.id).selectAll('*').remove();
        d3.select(simViewer.id).html('');
    });
};

var showSimilarityGroup = function(viewer) {
    viewer.similarityGroupDiv.style('display', 'block');
    viewer.secondaryArticleDiv.text('Hover any node for similarity data, click for annotation data');
};

var updateTopics = function(viewer) {
    var topics = viewer.options.topics[viewer.selectedContent.label];

    viewer.topicsSelect.selectAll('option').remove();
    viewer.topicsOption = viewer.topicsSelect.selectAll('option')
        .data(topics)
        .enter().append('option')
        .attr('value', function(topic) {return topic.id;})
        .text(function(topic) {return topic.text;});

    viewer.selectedTopic = topics[0].id;
    updateDistribution(viewer);
};

var updateDistribution = function(viewer) {
    var path = viewer.options.paths[viewer.selectedContent.label];
    var topics = viewer.options.topics[viewer.selectedContent.label];
    var articles = viewer.options.articles[viewer.selectedContent.label]
    var prefix = viewer.selectedContent.prefix;

    var topicArticles = _.filter(articles, function(art) {
        return art.topic === viewer.selectedTopic;
    });
    var articleIds = _.pluck(topicArticles, 'id');

    loadAnnotations(viewer, topicArticles);

    jQuery.when.apply(null, viewer.loaders)
        .then(function() {
            var distData = viewer.parser.calculateDistribution(viewer.annotatedArticles[viewer.selectedContent.label],
                viewer.options.onlyTF);
            viewer.topicDistribution.setData(distData);
            viewer.topicDistribution.render();

            if (viewer.articleTitle !== undefined) {
                if (topicArticles.length >= 3) {
                    showSimilarityGroup(viewer);
                    viewer.articleTitle.text('Click on any column in the distribution matrix to select an article and ' +
                        'display similarity network');
                } else {
                    hideSimilarityGroup(viewer);
                    viewer.articleTitle.text('Click on any column in the distribution matrix to select an article' +
                        'and display annotations');
                }
                //d3.select('#annotGroup').style('display', 'none');
                //d3.select('#clickNode').style('display', 'none');
            }
        }
    );
};

var loadAnnotations = function(viewer, topicArticles) {
    viewer.annotatedArticles = {};
    viewer.loaders = [];
    var content = viewer.selectedContent.label;
    var topic = viewer.selectedTopic;

    if (viewer.options.articles[content]) {
        viewer.annotatedArticles[content] = [];
        _.each(topicArticles, function(article) {
            loadAnnotatedArticle(viewer, content, article, viewer.options.paths[content], article.id);
        });
        var key = viewer.options.articles[content].seeAlso;
        if ((key !== undefined) && (viewer.options.articles[key])) {
            viewer.annotatedArticles[key] = [];
            _.each(viewer.options.articles[key], function(article) {
                if ((article.topic === topic) && (article.altId !== undefined)) {
                    loadAnnotatedArticle(viewer, key, article, viewer.options.paths[key], article.altId);
                }
            });
        }
    }
};

var loadAnnotatedArticle = function(viewer, content, article, path, id) {
    var loader = viewer.parser.loadAnnotations(path, id);
    viewer.loaders.push(loader);
    loader.done(function(loadedData) {
        if (article.altId) {
            viewer.annotatedArticles[content].push({id: article.id, display: article.title, altId: article.altId,
                annotations: loadedData.data});
        } else {
            viewer.annotatedArticles[content].push({id: article.id, display: article.title,
                annotations: loadedData.data});
        }
    }).fail( function(e) {
        console.log(e);
    });
};

var updateSimilarity = function(viewer) {
    viewer.secondaryArticleDiv.text('Hover any node for similarity information, click for semantic annotations cloud.');
};

module.exports = BiolinksViewer;
