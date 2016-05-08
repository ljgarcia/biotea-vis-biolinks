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
var GroupsDialog = require('./GroupsDialog');

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
    maxTerms: 40
};

/*
 * Public Methods
 */
var BiolinksViewer = function(opts){
    var viewer = this;
    viewer.options = _.extend({}, defaultOpts, opts);
    viewer.parser = new BiolinksParser();
    viewer.groupFilter = _.keys(viewer.parser.getModel().model);
    init(viewer);
};

var init = function(viewer) {
    var titleDiv = d3.select(viewer.options.el).append('h1').text(viewer.options.title);
    initControls(viewer);
    initContentAndTopics(viewer);
    initDistribution(viewer);
    initSimilarity(viewer);
    initAnnotations(viewer);
    updateTopics(viewer);
};

var initControls = function(viewer) {
    var sectionId = 'biolinks_section_controls' + new Date().getTime();
    var section = d3.select(viewer.options.el).append('section')
        .classed('biolinks_section', true)
        .attr('id', sectionId);

    var buttonsDiv = section.append('div').classed('biolinks_controls', true);
    var buttonGroup = buttonsDiv.append('button').text('Select groups of interest')
        .on('click', function() {
            viewer.groupsDialog.show(viewer.groupFilter);
        });

    jQuery(document).ready(function() {
        var sectionPos = jQuery('#' + sectionId).offset();
        var divWidth = jQuery('.biolinks_controls').width();
        buttonsDiv.style('max-width', divWidth + 'px');

        var buttonPos = jQuery('#' + sectionId + ' button').offset();
        viewer.groupsDialog = new GroupsDialog(viewer, section, {left: buttonPos.left, top: buttonPos.top},
            viewer.groupFilter);

        jQuery(window).bind('scroll', function() {
            if (jQuery(window).scrollTop() > sectionPos.top) {
                buttonsDiv.style('position', 'fixed');
                viewer.groupsDialog.wrapper.style('position', 'fixed');
                viewer.groupsDialog.wrapper.style('top', '20px');
            } else {
                buttonsDiv.style('position', 'static');
                viewer.groupsDialog.wrapper.style('position', 'absolute');
                viewer.groupsDialog.wrapper.style('top', (buttonPos.top + 20) + 'px');
            }
        });
    });
};

var initContentAndTopics = function(viewer) {
    var section = d3.select(viewer.options.el).append('section');

    var contentDiv = section.append('div').classed('biolinks_content', true);
    contentDiv.append('span').text('Content/Chapter: ');
    viewer.contentSelect = contentDiv.append('span').append('select')
        .attr('id', 'biolinks_contentSelection')
        .on('change', function() {
            var selectedIndex = viewer.contentSelect.property('selectedIndex')
            viewer.selectedContent = viewer.contentOptions[0][selectedIndex].__data__;
            initSimilarityViewer(viewer);
            initAnnotationViewers(viewer);
            updateTopics(viewer);
        });

    viewer.contentOptions = viewer.contentSelect.selectAll('option')
        .data(viewer.options.content)
        .enter().append('option')
        .attr('value', function(d) {return d.label;})
        .text(function(d) {return d.text;});
    viewer.selectedContent = viewer.options.content[0];

    var topicsDiv = section.append('div');
    topicsDiv.append('span').text('Topic/Subject: ');
    viewer.topicsSelect = topicsDiv.append('span').append('select')
        .attr('id', 'biolinks_topicsSelection')
        .on('change', function() {
            var selectedIndex = viewer.topicsSelect.property('selectedIndex')
            viewer.selectedTopic = viewer.topicsOption[0][selectedIndex].__data__.id;
            viewer.refresh = false;
            viewer.refreshReferenceId = undefined;
            viewer.refreshComparedId = undefined;
            viewer.updateDistribution();
        });
};

var initDistribution = function(viewer) {
    var section = d3.select(viewer.options.el).append('section');
    var distributionGroupDiv = section.append('div').classed('biolinks_distribution_group', true);
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
        .classed('biolinks_vis_distribution', true);
    viewer.topicDistribution = new DistributionViewer({
        el: '#' + distDivId,
        width: viewer.options.width,
        prefixId: viewer.selectedContent.prefix,
        alternativePrefixId: viewer.selectedContent.altPrefix
    });

    viewer.topicDistribution.getDispatcher().on('selected', function(obj) {
        if (obj.type === 'distribution') {
            var collection = viewer.options.articles[viewer.selectedContent.label];
            viewer.selectedReferenceArticle = _.find(collection, function(el) {
                return +obj.id === +el.id;
            });

            var articleText;
            if (viewer.selectedContent.url) {
                articleText = viewer.selectedReferenceArticle.title + ' (<a href="' + viewer.selectedContent.url +
                    viewer.selectedReferenceArticle.id + '" target="_blank">' + viewer.selectedContent.prefix + ':' +
                    viewer.selectedReferenceArticle.id + '</a>)';
            } else {
                articleText = viewer.selectedReferenceArticle.title + ' (' + viewer.selectedContent.prefix + ':' +
                    viewer.selectedReferenceArticle.id + ')';
            }

            viewer.articleTitle.html(articleText);

            if (viewer.topicArticles.length >= 2) {
                showSimilarityGroup(viewer);
                showAnnotationGroup(viewer);
                viewer.annotationReferenceTable.style('display', 'block');

                updateAnnotations(viewer, viewer.annotationViewerReference, 'biolinks_annotation_ref_viewer',
                    viewer.selectedReferenceArticle);
                updateSimilarity(viewer);
            } else {
                showAnnotationGroup(viewer);
                viewer.annotationReferenceTable.style('display', 'block');
                updateAnnotations(viewer, viewer.annotationViewerReference, 'biolinks_annotation_ref_viewer',
                    viewer.selectedReferenceArticle);
            }

        }
    });
};

var initSimilarity = function(viewer) {
    var section = d3.select(viewer.options.el).append('section');

    viewer.similarityGroupDiv = section.append('div')
        .classed('biolinks_similarity_group', true)
        .style('display', 'none');
    viewer.similarityGroupDiv.append('h2').text('Similarity network for selected-reference article');
    viewer.secondaryArticleDiv = viewer.similarityGroupDiv.append('div');
    viewer.similarityViewer = {};
    initSimilarityViewer(viewer);
};

var initSimilarityViewer = function(viewer) {
    if (viewer.similarityViewer.viewer) {
        viewer.similarityViewer.viewer.stopForce();
    }
    viewer.similarityViewer = {};
    viewer.similarityGroupDiv.selectAll('table').remove();
    var table = viewer.similarityGroupDiv.append('table').attr('width', '100%');
    viewer.similarityViewer = addVisualRows(viewer, table, 'Similarity',
        'biolinks_sim_', 'biolinks_similarity_viewer');

    viewer.similarityViewer.viewer = new SimilarityViewer({
        el: viewer.similarityViewer.id,
        width: viewer.options.width,
        height: viewer.options.similarityHeight,
        useAlternativeIds: false
    });

    viewer.similarityViewer.viewer.getDispatcher().on('selected', function(obj) {
        if (obj.type === 'similarity') {
            viewer.selectedComparedArticle = {id: '', altId: '', title: ''};
            viewer.selectedComparedArticle = _.find(viewer.topicArticles, function(article) {
                return article.id === obj.datum.relatedId;
            });

            var comparedText;
            if (viewer.selectedContent.url) {
                comparedText = viewer.selectedComparedArticle.title + ' (<a href="' + viewer.selectedContent.url +
                    viewer.selectedComparedArticle.id + '" target="_blank">' + viewer.selectedContent.prefix + ':' +
                    viewer.selectedComparedArticle.id + '</a>)';
            } else {
                comparedText = viewer.selectedComparedArticle.title + ' (' + viewer.selectedContent.prefix + ':' +
                    viewer.selectedComparedArticle.id + ')';
            }
            viewer.secondaryArticleTitle.html(comparedText);

            if (viewer.selectedReferenceArticle.id !== viewer.selectedComparedArticle.id) {
                viewer.annotationComparedTable.style('display', 'block');
                updateAnnotations(viewer, viewer.annotationViewerCompared, 'biolinks_annotation_comp_viewer',
                    viewer.selectedComparedArticle, obj.datum.terms);
                viewer.annotationViewerReference.viewer.setHighlight(obj.datum.terms);
            } else {
                d3.selectAll('.biolinks_annotation_comp_viewer').selectAll('*').remove();
                d3.selectAll('.biolinks_annotation_comp_viewer').html('');
                viewer.annotationComparedTable.style('display', 'none');
            }
        }
    });
};

var initAnnotations = function(viewer) {
    var section = d3.select(viewer.options.el).append('section');

    viewer.annotationGroupDiv = section.append('div')
        .classed('biolinks_annotation_group', true)
        .style('display', 'none');
    viewer.annotSectionTitle = viewer.annotationGroupDiv.append('h2')
        .text('Top ' + viewer.options.maxTerms + ' Semantic annotations for selected reference and compared articles');
    viewer.annotSectionCaption = viewer.annotationGroupDiv.append('div').classed('biolinks_caption', true)
        .html('Concepts present in both reference and compared articles are highlighted ' +
            '(even if they are not in the top ' + viewer.options.maxTerms + ' actually shown). </br>' +
            'Select a compared article by clicking any blue node in the similarity network');

    viewer.annotationViewerReference = {};
    viewer.annotationViewerCompared = {};
    initAnnotationViewers(viewer);

};

var initAnnotationViewers = function(viewer) {
    viewer.annotationGroupDiv.selectAll('table').remove();

    var tableContainer = viewer.annotationGroupDiv.append('div');

    viewer.annotationViewerReference = {};
    viewer.annotationReferenceTable = tableContainer.append('span').style('display', 'table-cell').append('table')
        .attr('width', '100%').style('display', 'none');
    viewer.annotationViewerReference = addVisualRows(viewer, viewer.annotationReferenceTable,
        'Annotations (reference article)', 'biolinks_annot_ref_',
        'biolinks_annotation_ref_viewer biolinks_vis_annotations');

    viewer.annotationViewerCompared = {};
    viewer.annotationComparedTable = tableContainer.append('span').style('display', 'table-cell').append('table')
        .attr('width', '100%').style('display', 'none');
    viewer.annotationViewerCompared = addVisualRows(viewer, viewer.annotationComparedTable,
        'Annotations (compared article)', 'biolinks_annot_comp_',
        'biolinks_annotation_comp_viewer biolinks_vis_annotations');
};

var addVisualRows = function(viewer, table, text, idPrefix, className) {
    var row = table.append('tr');
    row.append('th').text(text);
    row = table.append('tr');
    var divId = idPrefix + new Date().getTime();
    var componentViewerDisplay = row.append('td').append('div')
        .attr('id', divId)
        .attr('class', className);
    return {
        display: componentViewerDisplay,
        id: '#' + divId
    };
};

var hideSimilarityGroup = function(viewer) {
    viewer.similarityGroupDiv.style('display', 'none');
    d3.select(viewer.similarityViewer.id).selectAll('*').remove();
    d3.select(viewer.similarityViewer.id).html('');
};

var showSimilarityGroup = function(viewer) {
    viewer.similarityGroupDiv.style('display', 'block');
    viewer.secondaryArticleDiv.selectAll('h4').remove();
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
    viewer.refresh = false;
    viewer.refreshReferenceId = undefined;
    viewer.refreshComparedId = undefined;
    viewer.updateDistribution();
};

BiolinksViewer.prototype.updateDistribution = function() {
    var viewer = this;
    var path = viewer.options.paths[viewer.selectedContent.label];
    var topics = viewer.options.topics[viewer.selectedContent.label];
    var articles = viewer.options.articles[viewer.selectedContent.label]
    var prefix = viewer.selectedContent.prefix;

    viewer.topicArticles = _.filter(articles, function(art) {
        return art.topic === viewer.selectedTopic;
    });
    viewer.topicArticleIds = _.pluck(viewer.topicArticles, 'id');
    viewer.topicArticleAltIds = _.pluck(viewer.topicArticles, 'altId');

    if (viewer.refresh === true) {
        var distData = viewer.parser.calculateDistribution(viewer.annotatedArticles, viewer.groupFilter);
        viewer.topicDistribution.setData(distData);
        viewer.topicDistribution.setPrefix(viewer.selectedContent.prefix);
        viewer.topicDistribution.setAlternativePrefix(viewer.selectedContent.altPrefix);
        viewer.topicDistribution.render();

        hideSimilarityGroup(viewer);
        hideAnnotationGroup(viewer);

        viewer.topicDistribution.selectById(viewer.refreshReferenceId);
        viewer.refreshReferenceId = undefined;
    } else {
        loadAnnotations(viewer);

        jQuery.when.apply(null, viewer.loaders)
            .then(function() {
                var distData = viewer.parser.calculateDistribution(viewer.annotatedArticles);
                viewer.topicDistribution.setData(distData);
                viewer.topicDistribution.setPrefix(viewer.selectedContent.prefix);
                viewer.topicDistribution.setAlternativePrefix(viewer.selectedContent.altPrefix);
                viewer.topicDistribution.render();

                if (viewer.articleTitle !== undefined) {
                    if (viewer.topicArticles.length >= 2) {
                        viewer.annotSectionTitle
                            .text('Top ' + viewer.options.maxTerms + ' Semantic annotations for selected reference and compared articles');
                        viewer.annotSectionCaption.style('display', 'block');
                        viewer.articleTitle.text('Click on any column in the distribution matrix to select an article ' +
                            'and display similarity network');
                    } else {
                        viewer.annotSectionTitle
                            .text('Top ' + viewer.options.maxTerms + ' Semantic annotations for selected reference article');
                        viewer.annotSectionCaption.style('display', 'none');
                        viewer.articleTitle.text('Click on any column in the distribution matrix to select an article ' +
                            'and display annotations');
                    }
                    hideSimilarityGroup(viewer);
                    hideAnnotationGroup(viewer);
                }
            }
        );
    }
};

var updateSimilarity = function(viewer) {
    var queryArticle = {};
    var relatedIds = [];
    relatedIds = _.filter(viewer.annotatedArticles, function(annotatedArticle) {
        if (annotatedArticle.id === viewer.selectedReferenceArticle.id) {
            queryArticle = annotatedArticle;
        }
        return _.contains(viewer.topicArticleIds, annotatedArticle.id);
    });

    if (viewer.similarityViewer.viewer) {
        viewer.similarityViewer.viewer.stopForce();
    }

    d3.select(viewer.similarityViewer.id).selectAll('*').remove();
    d3.select(viewer.similarityViewer.id).html('');

    var data;
    if (viewer.refresh === true) {
        data = viewer.parser.calculateSimilarity(queryArticle, relatedIds, viewer.groupFilter);
    } else {
        data = viewer.parser.calculateSimilarity(queryArticle, relatedIds);
    }

    viewer.similarityViewer.viewer.setOptions({
        data: data,
        queryId: queryArticle.id,
        alternativeQueryId: queryArticle.altId,
        prefixId: viewer.selectedContent.prefix,
        alternativePrefixId: viewer.selectedContent.altPrefix
    });

    if ((viewer.refresh === true) && (viewer.refreshComparedId)) {
        viewer.similarityViewer.viewer.selectById(viewer.refreshComparedId);
        viewer.refreshComparedId = undefined;
    }
};

var updateAnnotations = function(viewer, annotViewer, className, selectedArticle, similarTerms) {
    d3.selectAll('.' + className).selectAll('*').remove();
    d3.selectAll('.' + className).html('');

    if (!similarTerms) {
        similarTerms = [];
    }

    annotViewer.viewer = createAnnotations(viewer, annotViewer, selectedArticle.id, similarTerms);
};

var createAnnotations = function(viewer, annotViewer, id, terms) {
    var data = _.find(viewer.annotatedArticles, function(article) {
        return article.id === id;
    });
    var options = {
        el: annotViewer.id,
        width: viewer.topicArticles.length >= 2 ? viewer.options.width/2 : viewer.options.width,
        height: viewer.options.annotationHeight,
        data: data.annotations,
        highlightedTermsId: terms,
        maxTerms: viewer.options.maxTerms
    };

    if (viewer.refresh) {
        options.filter = viewer.groupFilter;
    }

    var annotComponent = new AnnotationViewer(options);
    return annotComponent;
};

var loadAnnotations = function(viewer) {
    viewer.annotatedArticles = [];
    viewer.loaders = [];

    if (viewer.options.articles[viewer.selectedContent.label]) {
        viewer.annotatedArticles = [];
        _.each(viewer.topicArticles, function(article) {
            loadAnnotatedArticle(viewer, article);
        });
    }
};

var loadAnnotatedArticle = function(viewer, article) {
    var loader = viewer.parser.loadAnnotations(viewer.options.paths[viewer.selectedContent.label], article.id);
    viewer.loaders.push(loader);
    loader.done(function(loadedData) {
        if (article.altId) {
            viewer.annotatedArticles.push({id: article.id, display: article.title, altId: article.altId,
                annotations: loadedData.data});
        } else {
            viewer.annotatedArticles.push({id: article.id, display: article.title,
                annotations: loadedData.data});
        }
    }).fail( function(e) {
        console.log(e);
    });
};

module.exports = BiolinksViewer;
