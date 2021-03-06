var _ = require('underscore');
var PSQL = require('cartodb-psql');
var layersFilter = require('../../utils/layer_filter');

var RendererParams = require('../renderer_params');

var Renderer = require('./renderer');
var BaseAdaptor = require('../base_adaptor');

/**
 * API: initializes the renderer, it should be called once
 *
 * @param {Object} options
 *      - dbPoolParams: database connection pool params
 *          - size: maximum number of resources to create at any given time
 *          - idleTimeout: max milliseconds a resource can go unused before it should be destroyed
 *          - reapInterval: frequency to check for idle resources
 */
function PgMvtFactory(options) {
    this.options = options || {};
}

module.exports = PgMvtFactory;
const NAME = 'pg-mvt';
module.exports.NAME = NAME;

PgMvtFactory.prototype = {
    /// API: renderer name, use for information purposes
    name: NAME,

    /// API: tile formats this module is able to render
    supported_formats: ['mvt'],

    getName: function () {
        return this.name;
    },

    supportsFormat: function (format) {
        return format === 'mvt';
    },

    getAdaptor: function (renderer, format, onTileErrorStrategy) {
        return new BaseAdaptor(renderer, format, onTileErrorStrategy);
    },

    getRenderer: function (mapConfig, format, options, callback) {
        if (mapConfig.isVectorOnlyMapConfig() && format !== 'mvt') {
            const error = new Error(`Unsupported format: 'cartocss' option is missing for ${format}`);
            error.http_status = 400;
            error.type = 'tile';
            return callback(error);
        }

        var dbParams = RendererParams.dbParamsFromReqParams(options.params);
        var layer = options.layer;

        if (!this.supportsFormat(format)) {
            return callback(new Error("format not supported: " + format));
        }

        var mapLayers = mapConfig.getLayers();
        mapLayers.forEach((layer, layerIndex) => {
            layer.id = mapConfig.getLayerId(layerIndex);
        });

        var layerFilter = options.layer;
        var filteredLayers = layersFilter(mapConfig, layerFilter);
        if (filteredLayers.length < 1) {
            return callback(new Error("no mapnik layer in mapConfig"));
        }
        const layers = filteredLayers.map(layerIndex => mapConfig.getLayer(layerIndex));

        _.extend(dbParams, mapConfig.getLayerDatasource(layer));
        const psql = new PSQL(dbParams, this.options.dbPoolParams);
        if (Number.isFinite(mapConfig.getBufferSize('mvt'))) {
            this.options.bufferSize = mapConfig.getBufferSize('mvt');
        }
        return callback(null, new Renderer(layers, psql, {}, this.options));
    }
};
