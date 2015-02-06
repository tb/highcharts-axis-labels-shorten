/**
 * Highcharts plugin for shortening labels on x axis
 *
 * Author: Petr Benes
 * Email: xbenes@centrum.cz
 *
 * Usage: Set shortenLabels:true in the xAxis options
 * to enable shortening and skipping of axis labels
 *
 * Default: false
 */

/* global Highcharts */

(function (H) {
    'use strict';

    var SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

   /**
    * Create svg elements, with proper namespace
    * @param tag svg tag to be created, e.g. svg, text, ...
    * @param attrs optional attributes to set
    * @return created element
    */
    var makeSVG = function(tag, attrs) {
        var el = document.createElementNS(SVG_NAMESPACE, tag);
        for (var k in attrs) {
            if (attrs.hasOwnProperty(k)) {
                el.setAttribute(k, attrs[k]);
            }
        }
        return el;
    };

   /**
    * Measure text width/height with given className, in svg
    * @param text text to be measured
    * @param className className to apply to use for example correct font
    * @return width and height of the text
    */
    var measureText = function(text, className) {
        if (!text || text.length === 0) {
            return {
                height: 0,
                width: 0
            };
        }

        var container = makeSVG('svg');
        document.body.appendChild(container);

        if (className) {
            container.setAttribute('class', className);
        }

        var textSVG = makeSVG('text', {x: -1000, y: -1000});
        var textNode = document.createTextNode(text);
        textSVG.appendChild(textNode);
        container.appendChild(textSVG);

        var bbox = container.getBBox();
        document.body.removeChild(container);

        return {
            height: bbox.height,
            width: bbox.width
        };
    };

   /**
    * Get shortened text for given width with the measure fn provided
    * and optional className provided
    * @param text text to be shortened
    * @param width width to which the shortened text should fit
    * @param measureFunction function used to measure text
    * @param className class name to be assigned for example for specifying font
    * @return text shortened
    */
    var getShortened = function(text, width, measureFunction, className) {
        var w,
            short = text,
            shortened = false;

        do {
            w = measureFunction.call(this, short, className).width;
            if (w < width) {
                break;
            }

            shortened = true;
            var oneLetterApprox = w/short.length;
            var overlap = w - width;

            var keepChars = Math.max(0,
                    short.length - Math.ceil(overlap / oneLetterApprox) - 3);
            if (keepChars < 1) {
                return '.';
            }

            short = short.substring(0, keepChars);
        } while (true);

        return short + (shortened ? '...' : '');
    };

   /**
    * TextShortener
    * Utility class using the methods to shorten text and use cache in order
    * for not to measure texts again and use cache instead.
    *
    * @see
    * comments of getShortened and measureText for details on particular methods
    */
    var TextShortener = function() {
        this._cache = {};
    };

    TextShortener.prototype = {
        getShortened: function(text, width, className) {
            return getShortened.call(this, text, width, this.measureText, className);
        },

        measureText: function(text, className) {
            var classCache = this._cache[className] =
                this._cache[className] || {};

            if (classCache[text]) {
                return classCache[text];
            }

            classCache[text] = measureText.call(this, text, className);
            return classCache[text];
        }
    };

    var ts = new TextShortener();

    /**
     * Wrap Highcharts Axis inititalization
     */
    H.wrap(H.Axis.prototype, 'init', function(proceed, chart, options) {

        // treat shortening differently when labels are rotated
        var labelsRotated = options.labels && options.labels.rotation;

        if (!options.isX || !options.shortenLabels) {
            proceed.apply(this, [chart, options]);
            return;
        }

        H.merge(true, options, {
            labels: {
                maxStaggerLines: 1,
                overflow: false,
                formatter: function() {
                    // shorten; compute first how many pixels are available to one tick,
                    // provided that we have skipped some ticks
                    var pixelWidth = labelsRotated ? 200 :
                        Math.round(this.chart.plotWidth / this.axis.tickPositions.length);
                    // shortent text to pixel width using custom helpers
                    // Note: this is only svg-compliant, don't care about vml
                    return ts.getShortened(this.value, pixelWidth, 'highcharts-axis-labels');
                }
            },
            tickPositioner: function() {
                // label size in pixels
                var perTickWidth = labelsRotated ? 20 : 80,
                    ticks = Math.floor(this.chart.plotWidth / perTickWidth);

                // how many ticks we skip to keep them non-overlapping with
                // reasonable label size
                var skip = Math.ceil(this.categories.length / ticks);
                var indices = this.categories.map(function(category, index) {
                    return index;
                }).filter(function(idx) {
                    return idx % skip === 0;
                });
                return indices;
            },
            categories: options.categories.map(function(category) {
                return category.replace(/ /g, '\u00A0');
            })
        });

        proceed.apply(this, [chart, options]);

    });

}(Highcharts));
