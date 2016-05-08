/*jslint node: true */
/*jshint laxbreak: true */
"use strict";

var d3 = require("d3");
var _ = require("underscore");

var GroupsDialog = function(viewer, container, groups) {
    var dialog = this;

    dialog.init = function() {
        dialog.wrapper = container.append('div')
            .attr('class','biolinks_dialog')
            .style('display', 'none');

        dialog.checks = dialog.wrapper.append('div').style('text-align', 'left');
        dialog.checks.selectAll('div').data(groups).enter()
            .append('div');
        dialog.checks.selectAll('div').append('input')
            .attr('type', 'checkbox')
            .property('checked', true)
            .attr('name', function(grp) {return grp;});
        dialog.checks.selectAll('div').append('label')
            .text(function(grp) {return grp});

        dialog.buttons = dialog.wrapper.append('div').style('text-align', 'right');
        dialog.buttons.append('button').text('Apply')
            .on('click', function() {
                viewer.groupFilter = [];
                dialog.wrapper.selectAll('input')
                    .attr('name', function() {
                        var grp = d3.select(this).attr('name');
                        if (d3.select(this).property('checked') === true) {
                            viewer.groupFilter.push(grp);
                        }
                        return grp;
                    });
                viewer.refresh = true;
                viewer.refreshReferenceId = viewer.selectedReferenceArticle
                    ? viewer.selectedReferenceArticle.id : undefined;
                viewer.refreshComparedId = viewer.selectedComparedArticle
                    ? viewer.selectedComparedArticle.id : undefined;
                viewer.updateDistribution();
                dialog.hide();
        });
        dialog.buttons.append('button').text('Cancel')
            .on('click', function() {
                dialog.hide();
            });
    };

    dialog.show = function(filter) {
        dialog.wrapper
            .style('left', (d3.event.pageX + 5) + 'px')
            .style('top', (d3.event.pageY + 5) + 'px');
        dialog.wrapper.selectAll('input')
            .property('checked', function() {
                var grp = d3.select(this).attr('name');
                return _.contains(filter, grp);
            });
        dialog.wrapper.style('display', 'block');
    };

    dialog.hide = function() {
        dialog.wrapper.style('display', 'none');
    };

    dialog.init();
};

module.exports = GroupsDialog;