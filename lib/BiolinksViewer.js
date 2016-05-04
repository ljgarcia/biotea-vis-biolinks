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
    paths: {}
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
    initContentAndTopics(viewer);
    initDistribution(viewer);
    initSimilarity(viewer);
    initAnnotations(viewer);
    updateTopics(viewer);
};

var initContentAndTopics = function(viewer) {
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
};

var initDistribution = function(viewer) {
    var distributionGroupDiv = d3.select(viewer.options.el).append('div').classed('biolinks_distribution_group', true);
    distributionGroupDiv.append('h2').text('Biolinks (UMLS-based) group distribution')

    distributionGroupDiv.append('div').classed('biolinks_caption', true)
        .html('Rows are semantic groups and columns are articles, the darker a cell the more representative the '
            + 'semantic group for an article. <br/>White means the group is not present in the article. '
            + '<br/>Hover and click any cell for more information and options');

    var articleDiv = distributionGroupDiv.append('div').html('');
    var header = articleDiv.append('h4');
    header.append('span').text('Selected-reference Article: ');
    viewer.articleTitle = header.append('span').text('Select an article by clicking on any column in the ' +
        'distribution matrix. Hover for more information.');

    var distDivId = 'biolinks_dist_' + new Date().getTime();
    viewer.distributionDiv = distributionGroupDiv.append('div')
        .attr('id', distDivId)
        .classed('biolinks_distribution', true);
    viewer.topicDistribution = new DistributionViewer({
        el: '#' + distDivId,
        width: viewer.options.width
    });

    viewer.topicDistribution.getDispatcher().on('selected', function(obj) {
        if (obj.type === 'distribution') {
            var collection = viewer.options.articles[viewer.selectedContent.label];
            viewer.selectedReferenceArticle = _.find(collection, function(el) {
                return +obj.article === +el.id;
            });

            var articleText = viewer.selectedReferenceArticle.title + ' (' + viewer.selectedContent.prefix + ':' +
                viewer.selectedReferenceArticle.id + ')';
            viewer.articleTitle.text(articleText);

            if (viewer.topicArticles.length >= 3) {
                showSimilarityGroup(viewer);
                updateSimilarity(viewer);
                showAnnotationGroup(viewer);
                viewer.annotationReferenceTable.style('display', 'block');
                updateAnnotations(viewer, viewer.annotationViewersReference, 'biolinks_annotation_ref_viewer',
                    viewer.selectedReferenceArticle);
            } else {
                showAnnotationGroup(viewer);
                viewer.annotationReferenceTable.style('display', 'block');
                updateAnnotations(viewer, viewer.annotationViewersReference, 'biolinks_annotation_ref_viewer',
                    viewer.selectedReferenceArticle);
            }

        }
    });
};

var initSimilarity = function(viewer) {
    viewer.similarityGroupDiv = d3.select(viewer.options.el).append('div')
        .classed('biolinks_similarity_group', true)
        .style('display', 'none');
    viewer.similarityGroupDiv.append('h2').text('Similarity network for selected-reference article');
    viewer.secondaryArticleDiv = viewer.similarityGroupDiv.append('div');

    viewer.similarityViewers = {};
    var table = viewer.similarityGroupDiv.append('table').attr('width', '100%');
    addVisualRows(viewer, table, 'Similarity - ', 'biolinks_sim_', 'biolinks_similarity_viewer',
        viewer.similarityViewers);
};

var initAnnotations = function(viewer) {
    viewer.annotationGroupDiv = d3.select(viewer.options.el).append('div')
        .classed('biolinks_annotation_group', true)
        .style('display', 'none');
    viewer.annotationGroupDiv.append('h2').text('Semantic annotations for selected reference and compared articles');
    viewer.annotationGroupDiv.append('div').classed('biolinks_caption', true)
        .html('Concepts present in both reference and compared articles are highlighted. </br>' +
            'Select a compared article by clicking any blue node in the similarity network');

    viewer.annotationViewersReference = {};
    viewer.annotationReferenceTable = viewer.annotationGroupDiv.append('table')
        .attr('width', '100%').style('display', 'none');
    addVisualRows(viewer, viewer.annotationReferenceTable, 'Annotations (reference article) - ', 'biolinks_annot_',
        'biolinks_annotation_ref_viewer' , viewer.annotationViewersReference);

    viewer.annotationViewersCompared = {};
    viewer.annotationComparedTable = viewer.annotationGroupDiv.append('table')
        .attr('width', '100%').style('display', 'none');
    addVisualRows(viewer, viewer.annotationComparedTable, 'Annotations (compared article) - ', 'biolinks_annot_',
        'biolinks_annotation_comp_viewer', viewer.annotationViewersCompared);
};

var addVisualRows = function(viewer, table, text, idPrefix, className, components) {
    var temp = [];
    var row = table.append('tr');
    if (viewer.selectedContent.seeAlso) {
        row.append('th').attr('width', '50%')
            .text(text + viewer.selectedContent.text);
        var seeAlso = _.find(viewer.options.content, function(content) {
            return content.label === viewer.selectedContent.seeAlso;
        });
        row.append('th').text(text + ' ' + seeAlso.text);
        temp = [viewer.selectedContent, seeAlso];
    } else {
        row.append('th').text(text + ' ' + viewer.selectedContent.text);
        temp = [viewer.selectedContent];
    }
    row = table.append('tr');
    _.each(temp, function(content) {
        var divId = idPrefix + content.label + '_' + new Date().getTime();
        var componentViewer = row.append('td').append('div')
            .attr('id', divId)
            .classed(className, true);
        components[content.label] = {
            display: componentViewer,
            id: '#' + divId,
            content: content
        };
    });
};

var hideSimilarityGroup = function(viewer) {
    viewer.similarityGroupDiv.style('display', 'none');
    viewer.secondaryArticleDiv.selectAll('*').remove();
    viewer.secondaryArticleDiv.html('');
    _.each(viewer.similarityViewers, function(simViewer) {
        d3.select(simViewer.id).selectAll('*').remove();
        d3.select(simViewer.id).html('');
    });
};

var showSimilarityGroup = function(viewer) {
    viewer.similarityGroupDiv.style('display', 'block');
    var header = viewer.secondaryArticleDiv.append('h4');
    header.append('span').text('Selected-compared Article: ');
    viewer.secondaryArticleTitle = header.append('span').text('Select an article by clicking on any node ' +
       'in any of the graphs. Hover for more information.');
};

var hideAnnotationGroup = function(viewer) {
    viewer.annotationGroupDiv.style('display', 'none');
    viewer.annotationReferenceTable.style('display', 'none');
    d3.selectAll('.biolinks_annotation_ref_viewer').selectAll('*').remove();
    d3.selectAll('.biolinks_annotation_ref_viewer').html('');
    viewer.annotationComparedTable.style('display', 'none');
    d3.selectAll('.biolinks_annotation_comp_viewer').selectAll('*').remove();
    d3.selectAll('.biolinks_annotation_comp_viewer').html('');
};

var showAnnotationGroup = function(viewer) {
    viewer.annotationGroupDiv.style('display', 'block');
    viewer.annotationReferenceTable.style('display', 'none');
    viewer.annotationComparedTable.style('display', 'none');
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

    viewer.topicArticles = _.filter(articles, function(art) {
        return art.topic === viewer.selectedTopic;
    });
    viewer.topicArticleIds = _.pluck(viewer.topicArticles, 'id');
    viewer.topicArticleAltIds = _.pluck(viewer.topicArticles, 'altId');

    loadAnnotations(viewer);

    jQuery.when.apply(null, viewer.loaders)
        .then(function() {
            var distData = viewer.parser.calculateDistribution(viewer.annotatedArticles[viewer.selectedContent.label]);
            viewer.topicDistribution.setData(distData);
            viewer.topicDistribution.render();

            if (viewer.articleTitle !== undefined) {
                if (viewer.topicArticles.length >= 3) {
                    viewer.articleTitle.text('Click on any column in the distribution matrix to select an article ' +
                        'and display similarity network');
                } else {
                    viewer.articleTitle.text('Click on any column in the distribution matrix to select an article ' +
                        'and display annotations');
                }
                hideSimilarityGroup(viewer);
                hideAnnotationGroup(viewer);
            }
        }
    );
};

var updateSimilarity = function(viewer) {
    var queryArticle = {};
    var relatedIds = {};
    relatedIds[viewer.selectedContent.label] = _.filter(viewer.annotatedArticles[viewer.selectedContent.label],
        function(annotatedArticle) {
            if (annotatedArticle.id === viewer.selectedReferenceArticle.id) {
                queryArticle[viewer.selectedContent.label] = annotatedArticle;
            }
            return _.contains(viewer.topicArticleIds, annotatedArticle.id);
        }
    );

    var seeAlso;
    if (viewer.selectedContent.seeAlso) {
        relatedIds[viewer.selectedContent.seeAlso] = _.filter(viewer.annotatedArticles[viewer.selectedContent.seeAlso],
            function(annotatedArticle) {
                if (annotatedArticle.id === viewer.selectedReferenceArticle.altId) {
                    queryArticle[viewer.selectedContent.seeAlso] = annotatedArticle;
                }
                return _.contains(viewer.topicArticleAltIds, annotatedArticle.id);
            }
        );
        seeAlso = _.find(viewer.options.content, function(content) {
            return content.label === viewer.selectedContent.seeAlso;
        });
    }

    var keys = _.keys(viewer.similarityViewers);
    _.each(viewer.similarityViewers, function(simViewer, key) {
        if (simViewer.viewer) {
            simViewer.viewer.stopForce();
        }

        d3.select(simViewer.id).selectAll('*').remove();
        d3.select(simViewer.id).html('');

        var data = viewer.parser.calculateSimilarity(queryArticle[key], relatedIds[key]);

        var simil = new SimilarityViewer({
            el: simViewer.id,
            width: viewer.options.width / keys.length - 10,
            height: viewer.options.similarityHeight,
            data: data,
            queryId: queryArticle[key].id,
            alternativeQueryId: key === viewer.selectedContent.label
                ? queryArticle[key].altId
                : seeAlso ? queryArticle[viewer.selectedContent.label].id : undefined,
            prefixId: simViewer.content.prefix,
            alternativePrefixId: key === viewer.selectedContent.label
                ? seeAlso ? seeAlso.prefix : undefined
                : seeAlso ? viewer.selectedContent.prefix : undefined,
            useAlternativeIds: key === viewer.selectedContent.label ? false : true
        });

        viewer.similarityViewers[key].viewer = simil;

        viewer.similarityViewers[key].viewer.getDispatcher().on('selected', function(obj) {
            if (obj.type === 'similarity') {
                viewer.selectedComparedArticle = {id: '', altId: '', title: ''};
                if (key === viewer.selectedContent.label) {
                    viewer.selectedComparedArticle = _.find(viewer.topicArticles, function(article) {
                        return article.id === obj.datum.relatedId;
                    });
                } else {
                    viewer.selectedComparedArticle = _.find(viewer.topicArticles, function(article) {
                        return article.id === obj.datum.altId;
                    });
                }
                viewer.secondaryArticleTitle.text(viewer.selectedComparedArticle.title);

                if (viewer.selectedReferenceArticle.id !== viewer.selectedComparedArticle.id) {
                    viewer.annotationComparedTable.style('display', 'block');
                    updateAnnotations(viewer, viewer.annotationViewersCompared, 'biolinks_annotation_comp_viewer',
                        viewer.selectedComparedArticle);
                } else {
                    d3.selectAll('.biolinks_annotation_comp_viewer').selectAll('*').remove();
                    d3.selectAll('.biolinks_annotation_comp_viewer').html('');
                    viewer.annotationComparedTable.style('display', 'none');
                }
            }
        });
    });
};

var updateAnnotations = function(viewer, annotViewers, className, selectedArticle) {
    d3.selectAll('.' + className).selectAll('*').remove();
    d3.selectAll('.' + className).html('');

    var keys = _.keys(annotViewers);
    _.each(annotViewers, function(annotViewer, key) {
        if (key === viewer.selectedContent.label) {
            annotViewer.viewer = createAnnotations(viewer, key, keys.length, annotViewer, selectedArticle.id);
        } else if (key === viewer.selectedContent.seeAlso) {
            annotViewer.viewer = createAnnotations(viewer, key, keys.length, annotViewer, selectedArticle.altId);
        }
    });
};

var createAnnotations = function(viewer, key, length, annotViewer, id) {
    var data = _.find(viewer.annotatedArticles[key], function(article) {return article.id === id;});
    var annotComponent = new AnnotationViewer({
        el: annotViewer.id,
        width: viewer.options.width / length - 10,
        height: viewer.options.annotationHeight,
        data: data.annotations
    });
    return annotComponent;
};

var loadAnnotations = function(viewer) {
    viewer.annotatedArticles = {};
    viewer.loaders = [];
    var content = viewer.selectedContent.label;
    var topic = viewer.selectedTopic;

    if (viewer.options.articles[content]) {
        viewer.annotatedArticles[content] = [];
        _.each(viewer.topicArticles, function(article) {
            loadAnnotatedArticle(viewer, content, article, viewer.options.paths[content]);
        });
        var key = viewer.selectedContent.seeAlso;
        if ((key !== undefined) && (viewer.options.articles[key])) {
            viewer.annotatedArticles[key] = [];
            _.each(viewer.options.articles[key], function(article) {
                if ((article.topic === topic) && (_.contains(viewer.topicArticleAltIds, article.id))) {
                    loadAnnotatedArticle(viewer, key, article, viewer.options.paths[key]);
                }
            });
        }
    }
};

var loadAnnotatedArticle = function(viewer, content, article, path) {
    var loader = viewer.parser.loadAnnotations(path, article.id);
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

module.exports = BiolinksViewer;
